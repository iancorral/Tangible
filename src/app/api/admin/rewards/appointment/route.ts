import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasFeature, requireStudio } from "@/lib/tenant";
import { getAppointmentAmount } from "@/lib/pricing";
import { UNSPENT_STAMP, computeRewardAmount } from "@/lib/rewards";
import { getRewardProgram, getStampBalance } from "@/lib/rewards.server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Why an appointment cannot earn a stamp. Drives the wording at checkout. */
type Blocker = "NO_CUSTOMER" | "CANCELLED" | "FREE" | "REDEEMED";

const actionSchema = z.object({
  appointmentId: z.string().regex(OBJECT_ID, "ID inválido"),
  action: z.enum(["GRANT", "REVOKE"]),
});

const stampKey = (appointmentId: string) => `appt:${appointmentId}`;

/**
 * Loyalty state for one appointment, everything the checkout screen needs in a
 * single request: whether a stamp can be given, whether one already was, the
 * client's balance, and what the reward would be worth against this bill.
 */
async function readState(studioId: string, appointmentId: string) {
  const [program, appointment] = await Promise.all([
    getRewardProgram(studioId),
    prisma.appointment.findUnique({
      where: { id: appointmentId, studioId },
      include: {
        services: true,
        customer: { select: { id: true, name: true, joinedAt: true } },
      },
    }),
  ]);

  if (!appointment) return null;

  const joinedAt = appointment.customer?.joinedAt ?? null;

  const [stamp, redemption] = await Promise.all([
    prisma.stamp.findUnique({
      where: { dedupeKey: stampKey(appointmentId), studioId },
      select: { id: true, redemptionId: true },
    }),
    prisma.redemption.findUnique({
      where: { dedupeKey: stampKey(appointmentId), studioId },
      select: { id: true, amountApplied: true, rewardLabel: true },
    }),
  ]);

  const baseAmount = getAppointmentAmount(appointment);

  // Order matters: the most actionable reason wins, because it is the one the
  // owner can do something about.
  let blocker: Blocker | null = null;
  if (!appointment.customerId) blocker = "NO_CUSTOMER";
  else if (appointment.status === "CANCELLED") blocker = "CANCELLED";
  else if (redemption) blocker = "REDEEMED";
  else if (baseAmount <= 0) blocker = "FREE";

  const stamps = appointment.customerId
    ? await getStampBalance(studioId, appointment.customerId)
    : 0;

  return {
    program,
    customer: appointment.customer,
    clientName: appointment.clientName,
    // Whether she has ever activated her card on a phone, which is what decides
    // if the owner should be offering her a code.
    enrolled: appointment.customer ? joinedAt !== null : false,
    stamps,
    ready: stamps >= program.stampsRequired,
    stampGranted: stamp !== null,
    redemption,
    baseAmount,
    // What Canjear would take off this bill right now.
    previewDiscount: baseAmount > 0 ? computeRewardAmount(program, baseAmount) : 0,
    blocker,
    canGrant: blocker === null && stamp === null,
  };
}

export async function GET(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  const appointmentId = new URL(req.url).searchParams.get("appointmentId") ?? "";
  if (!OBJECT_ID.test(appointmentId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const state = await readState(studioId, appointmentId);
  if (!state) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  return NextResponse.json(state);
}

/**
 * Grants or removes this appointment's stamp.
 *
 * Idempotency is the unique index on `Stamp.dedupeKey`, not a check in this
 * handler: a second GRANT is rejected by the database whatever the UI does, so a
 * double tap, a retry after a dropped connection, or two devices open at once
 * all converge on exactly one stamp.
 */
export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  try {
    const validation = actionSchema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { appointmentId, action } = validation.data;
    const state = await readState(studioId, appointmentId);
    if (!state) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (action === "GRANT") {
      if (!state.program.isActive) {
        return NextResponse.json(
          { error: "El programa de recompensas está desactivado" },
          { status: 409 }
        );
      }

      const messages: Record<Blocker, string> = {
        NO_CUSTOMER: "La cita no tiene teléfono, así que no hay ficha de clienta que sellar",
        CANCELLED: "Una cita cancelada no da sello",
        FREE: "Una cita gratis no da sello",
        REDEEMED: "Esta cita ya aplicó una recompensa",
      };
      if (state.blocker) {
        return NextResponse.json({ error: messages[state.blocker] }, { status: 409 });
      }

      try {
        await prisma.stamp.create({
          data: {
            studioId,
            customerId: state.customer!.id,
            dedupeKey: stampKey(appointmentId),
            source: "APPOINTMENT",
            appointmentId,
            // Written explicitly so the field is present, not absent. See
            // UNSPENT_STAMP in lib/rewards.ts for why that matters on MongoDB.
            redemptionId: null,
            createdBy: ctx.email,
          },
        });
      } catch (error) {
        // Already granted. The caller asked for one stamp on this appointment
        // and there is exactly one, so this is success, not a failure.
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
      }
    } else {
      // Only an unspent stamp can be taken back: one already consumed by a
      // reward stays put, or the reward would be worth more than it cost.
      const removed = await prisma.stamp.deleteMany({
        where: { studioId, dedupeKey: stampKey(appointmentId), ...UNSPENT_STAMP },
      });
      if (removed.count === 0 && state.stampGranted) {
        return NextResponse.json(
          { error: "Ese sello ya se usó en una recompensa" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(await readState(studioId, appointmentId));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
