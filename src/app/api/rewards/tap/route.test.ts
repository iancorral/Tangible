/**
 * El toque del NFC: al registrar la cita el sticker queda "armado" para esa
 * clienta, el primer toque del día de la cita da el sello y luego se bloquea.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  rewardProgram: { findUnique: vi.fn(), upsert: vi.fn() },
  appointment: { findMany: vi.fn(), findUnique: vi.fn() },
  redemption: { findUnique: vi.fn() },
  stamp: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
}));
const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieJar.value ? { value: cookieJar.value } : undefined) }),
}));

import { POST } from "./route";
import { createDevicePass } from "@/lib/rewards-access";

const STUDIO_ID = "6a00000000000000000000aa";
const CUSTOMER = "6a0000000000000000000c01";
const APPT = "6a0000000000000000000a01";
const STUDIO = { id: STUDIO_ID, slug: "tangible", features: { rewards: true, publicBooking: true } };

// Cita hoy a las 16:00 de Chihuahua (22:00Z).
const APPT_DATE = new Date("2026-10-13T22:00:00Z");
const appointment = (overrides: Record<string, unknown> = {}) => ({
  id: APPT,
  studioId: STUDIO_ID,
  customerId: CUSTOMER,
  status: "CONFIRMED",
  date: APPT_DATE,
  finalPrice: null,
  services: [{ price: 450 }],
  ...overrides,
});

const tapAt = async (iso: string) => {
  vi.setSystemTime(new Date(iso));
  const res = await POST();
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  process.env.REWARDS_PASS_SECRET = "test-secret";
  cookieJar.value = createDevicePass(CUSTOMER) ?? undefined;
  prismaMock.studio.findUnique.mockResolvedValue(STUDIO);
  prismaMock.rewardProgram.findUnique.mockResolvedValue({ studioId: STUDIO_ID, isActive: true });
  prismaMock.appointment.findMany.mockResolvedValue([{ id: APPT, date: APPT_DATE }]);
  prismaMock.appointment.findUnique.mockResolvedValue(appointment());
  prismaMock.redemption.findUnique.mockResolvedValue(null);
  prismaMock.stamp.findMany.mockResolvedValue([]);
  prismaMock.stamp.create.mockResolvedValue({});
  prismaMock.stamp.count.mockResolvedValue(1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/rewards/tap", () => {
  it("el día de su cita, el toque da el sello de esa cita", async () => {
    const { status, body } = await tapAt("2026-10-13T22:30:00Z");
    expect(status).toBe(200);
    expect(body).toEqual({ granted: true, stamps: 1 });
    expect(prismaMock.stamp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ studioId: STUDIO_ID, customerId: CUSTOMER, dedupeKey: `appt:${APPT}`, note: "Al pasar el celular" }),
    });
  });

  it("se puede desde una hora antes de la cita", async () => {
    await tapAt("2026-10-13T21:05:00Z");
    const { where } = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ studioId: STUDIO_ID, customerId: CUSTOMER, status: { not: "CANCELLED" } });
    // Solo considera citas que empiezan a más tardar en una hora.
    expect(where.date.lte.getTime()).toBe(new Date("2026-10-13T22:05:00Z").getTime());
  });

  it("después del primer toque se bloquea: tocar otra vez no suma", async () => {
    prismaMock.stamp.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" })
    );
    const { body } = await tapAt("2026-10-13T23:00:00Z");
    expect(body.granted).toBe(false);
  });

  it("una cita de ayer no se cobra hoy", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([{ id: APPT, date: new Date("2026-10-12T22:00:00Z") }]);
    const { body } = await tapAt("2026-10-13T18:00:00Z");
    expect(body.granted).toBe(false);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it("sin cita hoy, el toque solo abre la tarjeta", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    const { body } = await tapAt("2026-10-13T18:00:00Z");
    expect(body).toEqual({ granted: false, stamps: 1 });
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it("una cita gratis o con recompensa aplicada no da sello", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointment({ finalPrice: 0 }));
    expect((await tapAt("2026-10-13T22:30:00Z")).body.granted).toBe(false);

    prismaMock.appointment.findUnique.mockResolvedValue(appointment());
    prismaMock.redemption.findUnique.mockResolvedValue({ id: "r1" });
    expect((await tapAt("2026-10-13T22:30:00Z")).body.granted).toBe(false);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it("programa apagado: no da sello", async () => {
    prismaMock.rewardProgram.findUnique.mockResolvedValue({ studioId: STUDIO_ID, isActive: false });
    expect((await tapAt("2026-10-13T22:30:00Z")).body.granted).toBe(false);
  });

  it("sin tarjeta activada (o pase falsificado): 401", async () => {
    cookieJar.value = undefined;
    expect((await tapAt("2026-10-13T22:30:00Z")).status).toBe(401);
    cookieJar.value = `${CUSTOMER}.${Date.now() + 86400000}.firma-falsa`;
    expect((await tapAt("2026-10-13T22:30:00Z")).status).toBe(401);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });
});
