import { isNotFound } from "@/lib/prisma-errors";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { hasConfirmedCollision } from "@/lib/availability";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED"]),
});

export async function PATCH(
  request: Request,
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
    const body = await request.json();
    const validation = patchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const { status } = validation.data;

    const existing = await prisma.appointment.findUnique({ where: { id, studioId } });
    if (!existing) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (
      status === "CONFIRMED" &&
      existing.status === "CANCELLED" &&
      existing.date.getTime() > Date.now()
    ) {
      const collision = await hasConfirmedCollision(studioId, existing.date, existing.endDate, id);
      if (collision) {
        return NextResponse.json(
          {
            error:
              "El horario ya fue ocupado por otra cita. Muévela a otro horario antes de restaurarla.",
          },
          { status: 409 }
        );
      }
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id, studioId },
      data: { status },
    });

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
