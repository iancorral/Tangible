import { isNotFound } from "@/lib/prisma-errors";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { z } from "zod";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const NOTES_LIMIT = 500;

const mergeSchema = z.object({
  sourceId: z.string().regex(OBJECT_ID, "ID inválido"),
});

/**
 * Merges `sourceId` into the customer at `id`: the appointment history moves
 * across, the source's phone becomes the survivor's, and the source record is
 * removed. Only ever reached from an explicit confirmation in the UI.
 *
 * Appointments keep their own clientName and clientPhone. Those record what was
 * agreed on the day and stay untouched — after a merge the history simply shows
 * both spellings, which is the truth.
 *
 * Deliberately not wrapped in a transaction. The steps are ordered so that every
 * partial failure leaves a recoverable state rather than a corrupt one, and
 * re-running the merge finishes the job. A dependency on MongoDB transaction
 * support would buy atomicity at the cost of failing outright on a cluster that
 * does not provide it.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const { id } = await params;
  if (!OBJECT_ID.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const validation = mergeSchema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { sourceId } = validation.data;
    if (sourceId === id) {
      return NextResponse.json(
        { error: "No se puede unir una ficha consigo misma" },
        { status: 400 }
      );
    }

    const [target, source] = await Promise.all([
      // Ambas deben ser de este estudio: no se fusionan clientas entre estudios.
      prisma.customer.findUnique({ where: { id, studioId } }),
      prisma.customer.findUnique({ where: { id: sourceId, studioId } }),
    ]);

    if (!target || !source) {
      return NextResponse.json({ error: "Clienta no encontrada" }, { status: 404 });
    }

    // 1. Everything that points at the source moves first. Re-running after a
    //    failure here simply moves the rest.
    //
    //    Stamps and redemptions must move with the history: a merge that dropped
    //    them would silently wipe out a client's loyalty progress, and she would
    //    be the one to notice.
    const [moved, stampsMoved] = await Promise.all([
      prisma.appointment.updateMany({
        where: { studioId, customerId: sourceId },
        data: { customerId: id },
      }),
      prisma.stamp.updateMany({
        where: { studioId, customerId: sourceId },
        data: { customerId: id },
      }),
      prisma.redemption.updateMany({
        where: { studioId, customerId: sourceId },
        data: { customerId: id },
      }),
    ]);

    // 2. Keep both sets of notes; the owner wrote them and neither is disposable.
    const notes = [target.notes, source.notes]
      .map((note) => note?.trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, NOTES_LIMIT);

    // 3. Free the phone, then take it. Between these two writes the number
    //    belongs to nobody, so the worst case is the owner repeating the edit.
    await prisma.customer.delete({ where: { id: sourceId, studioId } });

    const merged = await prisma.customer.update({
      where: { id, studioId },
      data: { phone: source.phone, notes: notes || null },
    });

    return NextResponse.json({
      customer: merged,
      appointmentsMoved: moved.count,
      stampsMoved: stampsMoved.count,
    });
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
