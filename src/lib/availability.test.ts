import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  appointment: { findMany: vi.fn() },
  note: { findMany: vi.fn() },
  availabilityOverride: { findFirst: vi.fn() },
  blockedDate: { findFirst: vi.fn() },
  workSchedule: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getPublicBusyIntervals, isSlotBookable, overlapsAny } from "./availability";
import { chihuahuaToUTC } from "./timezone";

// Un día futuro fijo para que "la fecha ya pasó" no interfiera.
const at = (h: number, m = 0) => chihuahuaToUTC(2030, 3, 12, h, m);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appointment.findMany.mockResolvedValue([]);
  prismaMock.note.findMany.mockResolvedValue([]);
  prismaMock.availabilityOverride.findFirst.mockResolvedValue(null);
  prismaMock.blockedDate.findFirst.mockResolvedValue(null);
  prismaMock.workSchedule.findFirst.mockResolvedValue({ isDayOff: false, startTime: "10:00", endTime: "19:00" });
});

describe("overlapsAny", () => {
  const busy = [{ start: at(10).getTime(), end: at(11).getTime() }];

  it("detecta traslapes y permite que se toquen los bordes", () => {
    expect(overlapsAny(at(10, 30), at(11, 30), busy)).toBe(true);
    expect(overlapsAny(at(11), at(12), busy)).toBe(false);
    expect(overlapsAny(at(9), at(10), busy)).toBe(false);
  });
});

describe("getPublicBusyIntervals", () => {
  it("las citas llevan 30 min de margen; las notas que apartan, no", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([{ date: at(10), endDate: at(11) }]);
    prismaMock.note.findMany.mockResolvedValue([{ startAt: at(15), endAt: at(16) }]);

    const busy = await getPublicBusyIntervals(at(0), at(24));

    expect(busy).toEqual([
      { start: at(10).getTime(), end: at(11, 30).getTime() },
      { start: at(15).getTime(), end: at(16).getTime() },
    ]);
    expect(prismaMock.note.findMany.mock.calls[0][0].where.blocksSchedule).toBe(true);
  });
});

describe("isSlotBookable", () => {
  it("una nota que aparta horario bloquea la reserva pública", async () => {
    prismaMock.note.findMany.mockResolvedValue([{ startAt: at(15), endAt: at(16) }]);
    expect(await isSlotBookable(at(15, 30), 60)).toEqual({ ok: false, reason: "Ese horario ya no está disponible" });
    expect(await isSlotBookable(at(16), 60)).toEqual({ ok: true });
  });

  it("respeta el margen después de una cita", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([{ date: at(10), endDate: at(11) }]);
    expect((await isSlotBookable(at(11), 60)).ok).toBe(false);
    expect((await isSlotBookable(at(11, 30), 60)).ok).toBe(true);
  });

  it("rechaza fuera del horario de atención y fechas pasadas", async () => {
    expect((await isSlotBookable(at(18, 30), 60)).ok).toBe(false);
    expect((await isSlotBookable(new Date(Date.now() - 60_000), 60)).ok).toBe(false);
  });
});
