import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { z } from 'zod';
import { isSlotBookable } from '@/lib/availability';
import { resolveCustomerId } from '@/lib/customers';
import { personNameSchema, phoneSchema } from '@/lib/validation';

const bookingSchema = z.object({
  clientName: personNameSchema,
  clientPhone: phoneSchema,
  serviceIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, "ID inválido"))
    .min(1)
    .max(10),
  date: z.string().datetime(),
  notes: z
    .string()
    .max(500)
    .transform(val => val.replace(/[<>"'`]/g, ""))
    .optional(),
  website_url: z.string().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.website_url && body.website_url.length > 0) {
      console.warn("Bot detectado y bloqueado.");
      return NextResponse.json({ message: "Procesado" }, { status: 200 }); 
    }

    const validation = bookingSchema.safeParse(body);

    if (!validation.success) {
      // The first problem, in words the client can act on — not the schema.
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Revisa tus datos" },
        { status: 400 }
      );
    }

    const { serviceIds, date, clientName, clientPhone } = validation.data;

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } }
    });

    if (services.length === 0) {
      return NextResponse.json({ error: "Servicios no encontrados" }, { status: 404 });
    }

    const totalDuration = services.reduce((acc, service) => acc + service.duration, 0);
    const startDate = new Date(date);
    const endDate = addMinutes(startDate, totalDuration);

    // Authoritative server-side availability check. The availability grid is only
    // advisory; never trust the client to have picked a valid, free slot.
    const slotCheck = await isSlotBookable(startDate, totalDuration);
    if (!slotCheck.ok) {
      return NextResponse.json({ error: slotCheck.reason }, { status: 409 });
    }

    const customerId = await resolveCustomerId(clientName, clientPhone);

    const appointment = await prisma.appointment.create({
      data: {
        date: startDate,
        endDate: endDate,
        clientName,
        clientPhone,
        customerId,
        status: 'CONFIRMED',
        services: {
          connect: serviceIds.map((id) => ({ id }))
        }
      }
    });

    return NextResponse.json(appointment, { status: 201 });

  } catch (error) {
    console.error("Error crítico:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}