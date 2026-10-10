import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { chihuahuaToUTC, utcDateToChihuahuaMinutes, minutesToTimeLabel } from "@/lib/timezone";
import { z } from "zod";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  excludeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export async function GET(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const { searchParams } = new URL(req.url);
  const validation = querySchema.safeParse({
    date: searchParams.get("date"),
    excludeId: searchParams.get("excludeId") ?? undefined,
  });
  if (!validation.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { date, excludeId } = validation.data;
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  const dayStart = chihuahuaToUTC(year, month, day, 0, 0);
  const dayEnd = chihuahuaToUTC(year, month, day + 1, 0, 0);

  const [override, schedule, appts] = await Promise.all([
    prisma.availabilityOverride.findFirst({ where: { studioId, date: { gte: dayStart, lt: dayEnd } } }),
    prisma.workSchedule.findFirst({ where: { studioId, dayOfWeek } }),
    prisma.appointment.findMany({
      where: {
        studioId,
        status: "CONFIRMED",
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { date: { gte: dayStart, lt: dayEnd } },
          { endDate: { gt: dayStart, lte: dayEnd } },
        ],
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // Resolve working hours: date override > weekly schedule > defaults
  let resolvedSchedule: { startTime: string; endTime: string; isDayOff: boolean };

  if (override?.isClosed) {
    resolvedSchedule = { startTime: "10:00", endTime: "19:00", isDayOff: true };
  } else if (override?.startTime && override?.endTime) {
    resolvedSchedule = { startTime: override.startTime, endTime: override.endTime, isDayOff: false };
  } else if (schedule) {
    resolvedSchedule = { startTime: schedule.startTime, endTime: schedule.endTime, isDayOff: schedule.isDayOff };
  } else {
    resolvedSchedule = { startTime: "10:00", endTime: "19:00", isDayOff: dayOfWeek === 0 };
  }

  return NextResponse.json({
    schedule: resolvedSchedule,
    appointments: appts.map((a) => {
      const startMin = utcDateToChihuahuaMinutes(a.date);
      const endMin = utcDateToChihuahuaMinutes(a.endDate);
      return {
        id: a.id,
        clientName: a.clientName,
        paymentStatus: a.paymentStatus,
        startMinutes: startMin,
        endMinutes: endMin > startMin ? endMin : endMin + 1440,
        startLabel: minutesToTimeLabel(startMin),
        endLabel: minutesToTimeLabel(endMin),
      };
    }),
  });
}
