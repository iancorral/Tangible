import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { chihuahuaToUTC, getChihuahuaParts } from "@/lib/timezone";


export async function GET() {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const today = getChihuahuaParts(new Date());
  const start = chihuahuaToUTC(today.year, today.month, today.day + 1, 0, 0);
  const end = chihuahuaToUTC(today.year, today.month, today.day + 2, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      studioId,
      status: "CONFIRMED",
      date: { gte: start, lt: end },
      clientPhone: { not: null },
    },
    include: { services: true },
    orderBy: { date: "asc" },
  });

  const ids = appointments.map((a) => a.id);
  const sentLog = ids.length
    ? await prisma.reminder.findMany({
        where: { studioId, appointmentId: { in: ids }, sent: true },
      })
    : [];
  const sentSet = new Set(sentLog.map((r) => r.appointmentId));

  return NextResponse.json(
    appointments.map((a) => ({
      id: a.id,
      clientName: a.clientName,
      clientPhone: a.clientPhone,
      date: a.date,
      services: a.services.map((s) => ({ name: s.name })),
      reminderSent: sentSet.has(a.id),
    }))
  );
}

export async function PATCH(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  try {
    const { appointmentId, sent } = await req.json();
    if (typeof appointmentId !== "string" || !/^[a-f\d]{24}$/i.test(appointmentId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
  
    const markSent = sent === undefined ? true : Boolean(sent);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId, studioId },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const existing = await prisma.reminder.findFirst({ where: { studioId, appointmentId } });
    if (existing) {
      await prisma.reminder.update({
        where: { id: existing.id, studioId },
        data: { sent: markSent, sentAt: markSent ? new Date() : null },
      });
    } else {
      await prisma.reminder.create({
        data: {
          studioId,
          appointmentId,
          clientName: appointment.clientName,
          clientPhone: appointment.clientPhone ?? "",
          scheduledFor: appointment.date,
          sent: markSent,
          sentAt: markSent ? new Date() : null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
