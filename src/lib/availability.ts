import { prisma } from "@/lib/prisma";
import { addMinutes } from "date-fns";
import {
  chihuahuaToUTC,
  utcDateToChihuahuaMinutes,
  CHIHUAHUA_UTC_OFFSET,
} from "@/lib/timezone";

// Minutes of prep/cleanup buffer reserved after each appointment ends.
// Customers cannot book a slot that starts within this window after an appointment.
export const BUFFER_AFTER_APPOINTMENT = 30;

export type DayWindow = {
  /** True when the salon is closed (override closed, blocked date, or day off). */
  closed: boolean;
  /** Opening time as minutes-from-midnight (Chihuahua local). */
  startMinutes: number;
  /** Closing time as minutes-from-midnight (Chihuahua local). */
  endMinutes: number;
};

/**
 * Resolves the working-hours window for a Chihuahua calendar date.
 * Precedence: date-specific override > weekly schedule > defaults (10:00–19:00, Sundays off).
 */
export async function resolveDayWindow(
  year: number,
  month: number,
  day: number
): Promise<DayWindow> {
  const dayStart = chihuahuaToUTC(year, month, day, 0, 0);
  const dayEnd = chihuahuaToUTC(year, month, day + 1, 0, 0);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  const override = await prisma.availabilityOverride.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd } },
  });
  if (override?.isClosed) return { closed: true, startMinutes: 0, endMinutes: 0 };

  const blocked = await prisma.blockedDate.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd } },
  });
  if (blocked) return { closed: true, startMinutes: 0, endMinutes: 0 };

  if (override?.startTime && override?.endTime) {
    const [sh, sm] = override.startTime.split(":").map(Number);
    const [eh, em] = override.endTime.split(":").map(Number);
    return { closed: false, startMinutes: sh * 60 + sm, endMinutes: eh * 60 + em };
  }

  const schedule = await prisma.workSchedule.findFirst({ where: { dayOfWeek } });
  if (schedule?.isDayOff) return { closed: true, startMinutes: 0, endMinutes: 0 };

  const [startH, startM] = (schedule?.startTime ?? "10:00").split(":").map(Number);
  const [endH, endM] = (schedule?.endTime ?? "19:00").split(":").map(Number);
  return { closed: false, startMinutes: startH * 60 + startM, endMinutes: endH * 60 + endM };
}

export type SlotCheck = { ok: true } | { ok: false; reason: string };

type BusyInterval = { start: number; end: number };

/**
 * Everything that makes a moment unavailable to the public on a Chihuahua day,
 * as [start, end) epoch-millisecond ranges: confirmed appointments (plus the
 * cleanup buffer) and notes the owner marked as blocking her schedule. The
 * public grid and the booking write path both read from here, so the two can
 * never disagree about what is free.
 */
export async function getPublicBusyIntervals(
  dayStart: Date,
  dayEnd: Date,
  excludeAppointmentId?: string
): Promise<BusyInterval[]> {
  const [appointments, notes] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        OR: [
          { date: { gte: dayStart, lt: dayEnd } },
          { endDate: { gt: dayStart, lte: dayEnd } },
        ],
      },
      select: { date: true, endDate: true },
    }),
    prisma.note.findMany({
      where: { blocksSchedule: true, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const intervals: BusyInterval[] = appointments.map((app) => ({
    start: app.date.getTime(),
    end: addMinutes(app.endDate, BUFFER_AFTER_APPOINTMENT).getTime(),
  }));
  for (const note of notes) {
    if (note.startAt && note.endAt) {
      intervals.push({ start: note.startAt.getTime(), end: note.endAt.getTime() });
    }
  }
  return intervals;
}

export function overlapsAny(start: Date, end: Date, intervals: BusyInterval[]): boolean {
  const s = start.getTime();
  const e = end.getTime();
  return intervals.some((i) => s < i.end && e > i.start);
}

/**
 * Authoritative server-side check that a slot can actually be booked.
 * Mirrors the rules used to render the public availability grid so that the
 * write path cannot be bypassed by a crafted request: no past dates, salon open,
 * within working hours, and no collision with a confirmed appointment (+ buffer).
 */
export async function isSlotBookable(
  start: Date,
  durationMinutes: number,
  excludeId?: string
): Promise<SlotCheck> {
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "Fecha inválida" };
  if (start.getTime() <= Date.now()) return { ok: false, reason: "La fecha ya pasó" };

  // Chihuahua calendar date for the requested instant.
  const local = new Date(start.getTime() - CHIHUAHUA_UTC_OFFSET * 3600000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();

  const window = await resolveDayWindow(year, month, day);
  if (window.closed) return { ok: false, reason: "Ese día no está disponible" };

  const startMinutes = utcDateToChihuahuaMinutes(start);
  if (startMinutes < window.startMinutes || startMinutes + durationMinutes > window.endMinutes) {
    return { ok: false, reason: "Ese horario está fuera del horario de atención" };
  }

  const dayStart = chihuahuaToUTC(year, month, day, 0, 0);
  const dayEnd = chihuahuaToUTC(year, month, day + 1, 0, 0);
  const end = addMinutes(start, durationMinutes);

  const busy = await getPublicBusyIntervals(dayStart, dayEnd, excludeId);
  if (overlapsAny(start, end, busy)) return { ok: false, reason: "Ese horario ya no está disponible" };

  return { ok: true };
}

/**
 * True when a CONFIRMED appointment (other than `excludeId`) overlaps the
 * [start, end) window on the same Chihuahua day, counting the post-appointment
 * buffer. Unlike `isSlotBookable` this ignores working hours and past dates, so
 * it can guard restoring a cancelled appointment back into a slot that was
 * re-booked while it was cancelled without rejecting legitimate off-hours slots.
 */
export async function hasConfirmedCollision(
  start: Date,
  end: Date,
  excludeId?: string
): Promise<boolean> {
  const local = new Date(start.getTime() - CHIHUAHUA_UTC_OFFSET * 3600000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const dayStart = chihuahuaToUTC(year, month, day, 0, 0);
  const dayEnd = chihuahuaToUTC(year, month, day + 1, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { date: { gte: dayStart, lt: dayEnd } },
        { endDate: { gt: dayStart, lte: dayEnd } },
      ],
    },
  });

  return appointments.some((app) => {
    const appStart = new Date(app.date);
    const appEndWithBuffer = addMinutes(new Date(app.endDate), BUFFER_AFTER_APPOINTMENT);
    return start.getTime() < appEndWithBuffer.getTime() && end.getTime() > appStart.getTime();
  });
}
