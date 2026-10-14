import { isNotFound } from "@/lib/prisma-errors";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasFeature, requireStudio } from "@/lib/tenant";
import { grantAppointmentStampIfEligible, revokeAppointmentStamp } from "@/lib/rewards.server";
import { getAppointmentAmount } from "@/lib/pricing";
import { z } from "zod";

const paymentSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
  // Nullable so a method can be cleared — a free appointment has none.
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]).optional().nullable(),
  // `0` marks a free (courtesy) appointment: it still counts as an appointment
  // but never adds to revenue.
  finalPrice: z.number().min(0).optional().nullable(),
  depositPaid: z.boolean().optional(),
  depositAmount: z.number().min(0).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const { id } = await params;

  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validation = paymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const updated = await prisma.appointment.update({
      where: { id, studioId },
      data: validation.data,
      include: { services: true },
    });

    // Cobrada = sello (si no lo cobró ya con el NFC). Si falla, el pago ya
    // quedó guardado y la dueña puede darlo a mano; no se le muestra un error
    // por algo secundario. Si quedó gratis, la cita deja de dar sello.
    let stampGranted = false;
    if (getAppointmentAmount(updated) <= 0) {
      await revokeAppointmentStamp(studioId, id).catch((error) => console.error("Quitar sello:", error));
    } else if (updated.paymentStatus === "PAID" && hasFeature(ctx.studio, "rewards")) {
      stampGranted = await grantAppointmentStampIfEligible(studioId, id, ctx.email).catch((error) => {
        console.error("Sello automático:", error);
        return false;
      });
    }

    return NextResponse.json({ ...updated, stampGranted });
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}