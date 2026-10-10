import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasFeature, requireStudio } from "@/lib/tenant";
import { getAppointmentAmount } from "@/lib/pricing";
import { UNSPENT_STAMP, computeRewardAmount } from "@/lib/rewards";
import { getRewardProgram, getStampBalance } from "@/lib/rewards.server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const OBJECT_ID = /^[a-f\d]{24}$/i;

const redeemSchema = z.object({
  customerId: z.string().regex(OBJECT_ID, "ID inválido"),
  // Present when redeeming at checkout, which is what turns the reward into an
  // actual discount. Absent when the owner just records that a reward was given.
  appointmentId: z.string().regex(OBJECT_ID, "ID inválido").optional(),
});

/** Key that makes "one reward per appointment" a database guarantee. */
const dedupeKeyFor = (appointmentId?: string) =>
  appointmentId ? `appt:${appointmentId}` : `manual:${randomUUID()}`;

/**
 * Hands over a reward: consumes the oldest `stampsRequired` unspent stamps and
 * records what was given.
 *
 * When an appointment is supplied the discount is written to its `finalPrice`,
 * which is all that is needed for the reward to appear correctly everywhere
 * else — lib/pricing.ts already treats `finalPrice` as the authority and the
 * revenue breakdown already buckets from it. No parallel discount concept.
 *
 * The reward's wording and numbers are snapshotted onto the Redemption, so
 * editing the program tomorrow never rewrites what a client received today.
 *
 * Stamps are claimed oldest first: the fair reading of a punch card, and what
 * makes an expiry rule addable later without reshuffling history.
 */
export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  try {
    const validation = redeemSchema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { customerId, appointmentId } = validation.data;
    const program = await getRewardProgram(studioId);

    if (!program.isActive) {
      return NextResponse.json(
        { error: "El programa de recompensas está desactivado" },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId, studioId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Clienta no encontrada" }, { status: 404 });
    }

    let baseAmount = 0;
    let discount: number | null = null;

    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId, studioId },
        include: { services: true },
      });

      if (!appointment) {
        return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
      }
      if (appointment.customerId !== customerId) {
        return NextResponse.json(
          { error: "La cita no es de esta clienta" },
          { status: 400 }
        );
      }
      if (appointment.status === "CANCELLED") {
        return NextResponse.json(
          { error: "No se puede canjear en una cita cancelada" },
          { status: 409 }
        );
      }

      baseAmount = getAppointmentAmount(appointment);
      if (baseAmount <= 0) {
        return NextResponse.json(
          { error: "La cita es gratis: no hay nada que descontar" },
          { status: 409 }
        );
      }

      // An appointment either earns a stamp or carries a reward, never both.
      const stamp = await prisma.stamp.findUnique({
        where: { dedupeKey: `appt:${appointmentId}`, studioId },
        select: { id: true },
      });
      if (stamp) {
        return NextResponse.json(
          { error: "Esta cita ya dio un sello. Quítalo antes de canjear." },
          { status: 409 }
        );
      }

      discount = computeRewardAmount(program, baseAmount);
    }

    const claimable = await prisma.stamp.findMany({
      where: { studioId, customerId, ...UNSPENT_STAMP },
      orderBy: { earnedAt: "asc" },
      take: program.stampsRequired,
      select: { id: true },
    });

    if (claimable.length < program.stampsRequired) {
      return NextResponse.json(
        { error: `Faltan sellos: tiene ${claimable.length} de ${program.stampsRequired}` },
        { status: 409 }
      );
    }

    let redemption;
    try {
      redemption = await prisma.redemption.create({
        data: {
          studioId,
          customerId,
          appointmentId: appointmentId ?? null,
          dedupeKey: dedupeKeyFor(appointmentId),
          stampsUsed: program.stampsRequired,
          rewardLabel: program.rewardLabel,
          rewardType: program.rewardType,
          rewardValue: program.rewardValue,
          maxRewardValue: program.maxRewardValue,
          amountApplied: discount,
          createdBy: ctx.email,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Esta cita ya tiene una recompensa aplicada" },
          { status: 409 }
        );
      }
      throw error;
    }

    // Conditional claim: the UNSPENT filter means a stamp already taken by a
    // concurrent redemption cannot be counted twice. If we did not get every
    // stamp we asked for, nothing is handed over.
    const claimed = await prisma.stamp.updateMany({
      where: { studioId, id: { in: claimable.map((s) => s.id) }, ...UNSPENT_STAMP },
      data: { redemptionId: redemption.id },
    });

    const rollback = async () => {
      await prisma.stamp.updateMany({
        where: { studioId, redemptionId: redemption.id },
        data: { redemptionId: null },
      });
      await prisma.redemption.delete({ where: { id: redemption.id, studioId } });
    };

    if (claimed.count !== program.stampsRequired) {
      await rollback();
      return NextResponse.json(
        { error: "Los sellos cambiaron mientras se canjeaba. Intenta de nuevo." },
        { status: 409 }
      );
    }

    if (appointmentId && discount != null) {
      try {
        // The discount becomes the appointment's real price. Everything
        // downstream — revenue buckets, average ticket, the free tag — reads
        // this one number and needs no knowledge of rewards.
        await prisma.appointment.update({
          where: { id: appointmentId, studioId },
          data: { finalPrice: baseAmount - discount },
        });
      } catch (error) {
        // Never leave stamps spent against a discount that was not applied.
        await rollback();
        throw error;
      }
    }

    const stamps = await getStampBalance(studioId, customerId);

    return NextResponse.json({
      redemption,
      stamps,
      ready: stamps >= program.stampsRequired,
      finalPrice: discount != null ? baseAmount - discount : null,
      discount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
