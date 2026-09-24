import { NextResponse } from "next/server";
import { addMinutes, isBefore } from "date-fns";
import { z } from "zod";
import { chihuahuaToUTC, minutesToLabel, CHIHUAHUA_UTC_OFFSET } from "@/lib/timezone";
import { resolveDayWindow, getPublicBusyIntervals, overlapsAny } from "@/lib/availability";

export const dynamic = "force-dynamic";

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().min(15).max(480),
  excludeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const durationParam = searchParams.get("duration");
  const excludeIdParam = searchParams.get("excludeId");

  const validation = availabilitySchema.safeParse({
    date: dateParam,
    duration: durationParam ? parseInt(durationParam) : undefined,
    excludeId: excludeIdParam ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { date, duration, excludeId } = validation.data;
  const [year, month, day] = date.split("-").map(Number);

  try {
    const dayStart = chihuahuaToUTC(year, month, day, 0, 0);
    const dayEnd = chihuahuaToUTC(year, month, day + 1, 0, 0);

    const window = await resolveDayWindow(year, month, day);
    if (window.closed) return NextResponse.json([]);
    const { startMinutes, endMinutes } = window;

    const now = new Date();
    const chihuahuaNow = new Date(now.getTime() - CHIHUAHUA_UTC_OFFSET * 3600000);
    const isToday =
      chihuahuaNow.getUTCFullYear() === year &&
      chihuahuaNow.getUTCMonth() === month - 1 &&
      chihuahuaNow.getUTCDate() === day;

    const busy = await getPublicBusyIntervals(dayStart, dayEnd, excludeId);
    const slots: string[] = [];
    let currentMinutes = startMinutes;

    while (currentMinutes + duration <= endMinutes) {
      const slotStart = chihuahuaToUTC(year, month, day, Math.floor(currentMinutes / 60), currentMinutes % 60);
      const slotEnd = addMinutes(slotStart, duration);

      if (isToday) {
        const thirtyMinFromNow = addMinutes(now, 30);
        if (isBefore(slotStart, thirtyMinFromNow)) {
          currentMinutes += 30;
          continue;
        }
      }

      if (!overlapsAny(slotStart, slotEnd, busy)) {
        slots.push(minutesToLabel(currentMinutes));
      }

      currentMinutes += 30;
    }

    return NextResponse.json(slots);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
