import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { resolveCustomerId } from "@/lib/customers";
import { fieldErrors, optionalPhoneSchema, personNameSchema } from "@/lib/validation";

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

const createSchema = z.object({
  clientName: personNameSchema,
  clientPhone: optionalPhoneSchema,
  serviceIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .min(1)
    .max(10),
  date: z.string().datetime(),
  adminNotes: z.string().max(500).optional().nullable(),
  depositAmount: z.number().min(0).nullable().optional(), 
  depositPaid: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

    const { serviceIds, date, clientName, clientPhone, adminNotes, depositAmount, depositPaid } =
      validation.data;

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });

    if (services.length === 0) {
      return NextResponse.json({ error: "Servicios no encontrados" }, { status: 404 });
    }

    const totalDuration = services.reduce((acc, s) => acc + s.duration, 0);
    const startDate = new Date(date);
    const endDate = addMinutes(startDate, totalDuration);

    // With a bad connection the owner may tap "Agendar" again after a request
    // that did reach the server. The same client, slot and services within a
    // few minutes is that retry, not a second booking: hand back the first one.
    const duplicate = await prisma.appointment.findFirst({
      where: {
        date: startDate,
        clientName,
        status: "CONFIRMED",
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      include: { services: true },
    });
    if (
      duplicate &&
      duplicate.serviceIDs.length === serviceIds.length &&
      serviceIds.every((sid) => duplicate.serviceIDs.includes(sid))
    ) {
      return NextResponse.json(duplicate, { status: 200 });
    }

    const customerId = await resolveCustomerId(clientName, clientPhone);

    const appointment = await prisma.appointment.create({
      data: {
        date: startDate,
        endDate,
        clientName,
        clientPhone,
        customerId,
        status: "CONFIRMED",
        createdByAdmin: true,
        adminNotes: adminNotes ?? null,
        depositAmount: depositAmount ?? null,
        depositPaid: depositPaid ?? false,
        services: {
          connect: serviceIds.map((id) => ({ id })),
        },
      },
      include: { services: true },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}