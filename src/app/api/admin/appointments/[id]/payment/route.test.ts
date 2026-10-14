/**
 * Sello automático al cobrar: la cita pagada suma su sello sin que la dueña
 * tenga que acordarse, pero nunca dos veces ni donde no corresponde.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  appointment: { update: vi.fn(), findUnique: vi.fn() },
  rewardProgram: { findUnique: vi.fn(), upsert: vi.fn() },
  redemption: { findUnique: vi.fn() },
  stamp: { create: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { PATCH } from "./route";

const STUDIO_ID = "6a00000000000000000000aa";
const APPT = "6a0000000000000000000a01";
const CUSTOMER = "6a0000000000000000000c01";
const studio = (rewards: boolean) => ({
  id: STUDIO_ID,
  slug: "tangible",
  name: "Tangible",
  shortName: "Tangible",
  logoPath: null,
  features: { rewards, publicBooking: true },
});

const appointment = (overrides: Record<string, unknown> = {}) => ({
  id: APPT,
  studioId: STUDIO_ID,
  customerId: CUSTOMER,
  status: "COMPLETED",
  paymentStatus: "PAID",
  finalPrice: null,
  services: [{ price: 450 }],
  ...overrides,
});

const pay = async (body: Record<string, unknown> = { paymentStatus: "PAID", paymentMethod: "CASH" }) => {
  const res = await PATCH(
    new Request("http://test", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: APPT }) }
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: "user-tania", email: "tania@test", name: "Tania", studioId: STUDIO_ID } });
  prismaMock.user.findUnique.mockResolvedValue({
    studioId: STUDIO_ID,
    email: "tania@test",
    name: "Tania",
    mustChangePassword: false,
    passwordChangedAt: null,
  });
  prismaMock.studio.findUnique.mockResolvedValue(studio(true));
  prismaMock.rewardProgram.findUnique.mockResolvedValue({ studioId: STUDIO_ID, isActive: true });
  prismaMock.appointment.update.mockResolvedValue(appointment());
  prismaMock.appointment.findUnique.mockResolvedValue(appointment());
  prismaMock.redemption.findUnique.mockResolvedValue(null);
  prismaMock.stamp.create.mockResolvedValue({});
});

describe("PATCH /api/admin/appointments/[id]/payment — sello automático", () => {
  it("al quedar pagada, da el sello de esa cita (una sola llave por cita)", async () => {
    const { status, body } = await pay();
    expect(status).toBe(200);
    expect(body.stampGranted).toBe(true);
    expect(prismaMock.stamp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studioId: STUDIO_ID,
        customerId: CUSTOMER,
        dedupeKey: `appt:${APPT}`,
        source: "APPOINTMENT",
      }),
    });
  });

  it("guardar el pago otra vez no da un segundo sello", async () => {
    prismaMock.stamp.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" })
    );
    const { status, body } = await pay();
    expect(status).toBe(200);
    expect(body.stampGranted).toBe(false);
  });

  it.each(["PENDING", "PARTIAL"])("cobro %s: sin sello", async (paymentStatus) => {
    prismaMock.appointment.update.mockResolvedValue(appointment({ paymentStatus }));
    const { body } = await pay({ paymentStatus });
    expect(body.stampGranted).toBe(false);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it.each([
    ["gratis", { finalPrice: 0 }],
    ["cancelada", { status: "CANCELLED" }],
    ["sin ficha (sin teléfono)", { customerId: null }],
  ])("cita %s: sin sello", async (_label, overrides) => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointment(overrides));
    const { body } = await pay();
    expect(body.stampGranted).toBe(false);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it("si la cita aplicó una recompensa, no da sello", async () => {
    prismaMock.redemption.findUnique.mockResolvedValue({ id: "r1" });
    const { body } = await pay();
    expect(body.stampGranted).toBe(false);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it("programa apagado o estudio sin Premios: sin sello", async () => {
    prismaMock.rewardProgram.findUnique.mockResolvedValue({ studioId: STUDIO_ID, isActive: false });
    expect((await pay()).body.stampGranted).toBe(false);

    prismaMock.studio.findUnique.mockResolvedValue(studio(false));
    expect((await pay()).body.stampGranted).toBe(false);
    expect(prismaMock.stamp.create).not.toHaveBeenCalled();
  });

  it("si el sello falla, el pago igual queda guardado", async () => {
    prismaMock.stamp.create.mockRejectedValue(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await pay();
    expect(status).toBe(200);
    expect(body.paymentStatus).toBe("PAID");
    expect(body.stampGranted).toBe(false);
  });
});
