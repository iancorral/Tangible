import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { resolveCustomerId } from "@/lib/customers";
import { fieldErrors, optionalPhoneSchema, personNameSchema } from "@/lib/validation";

const createSchema = z.object({
  clientName: personNameSchema,
  // Ausente = no se toca; vacío = se quita el teléfono de la cita.
  clientPhone: z.undefined().or(optionalPhoneSchema),
  serviceIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .min(1)
    .max(10),
  date: z.string().datetime().optional(),
  adminNotes: z.string().max(500).optional().nullable(),
  // null = volver al precio de catálogo; 0 = cortesía.
  finalPrice: z.number().min(0).max(100000).nullable().optional(),
  depositAmount: z.number().min(0).nullable().optional(), // ← acepta null
  depositPaid: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Revisa los datos de la cita", fields: fieldErrors(validation.error) },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Determinar duración total: nuevos servicios si vienen, si no los actuales
    let totalDuration: number;
    let serviceConnect: { id: string }[] | undefined;

    if (data.serviceIds) {
      const services = await prisma.service.findMany({
        where: { id: { in: data.serviceIds } },
      });
      if (services.length === 0) {
        return NextResponse.json({ error: "Servicios no encontrados" }, { status: 404 });
      }
      totalDuration = services.reduce((acc, s) => acc + s.duration, 0);
      serviceConnect = data.serviceIds.map((sid) => ({ id: sid }));
    } else {
      const existing = await prisma.appointment.findUnique({
        where: { id },
        include: { services: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
      }
      totalDuration = existing.services.reduce((acc, s) => acc + s.duration, 0);
    }

    // Fecha base: la nueva si viene, si no la existente
    let startDate: Date;
    if (data.date) {
      startDate = new Date(data.date);
    } else {
      const existing = await prisma.appointment.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
      }
      startDate = existing.date;
    }

    const endDate = addMinutes(startDate, totalDuration);

    const updateData: Record<string, unknown> = {
      date: startDate,
      endDate,
    };
    if (data.clientName) updateData.clientName = data.clientName;
    // Si el campo viene en la petición (aunque sea vacío) se actualiza:
    // vacío → null para poder quitar el teléfono de una cita existente.
    if (data.clientPhone !== undefined) {
      const phone = data.clientPhone;
      updateData.clientPhone = phone;
      // Keep the customer link in step with the phone on the appointment.
      // Clearing the phone unlinks it: there is no longer anyone to point at.
      updateData.customerId = await resolveCustomerId(data.clientName, phone);
    }
    if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes;
    if (data.finalPrice !== undefined) updateData.finalPrice = data.finalPrice;
    if (serviceConnect) {
      updateData.services = { set: serviceConnect };
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { services: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}