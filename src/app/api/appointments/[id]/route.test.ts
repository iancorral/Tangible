/** Cancelar una cita que ya dio su sello (por el NFC) se lo quita. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  appointment: { findUnique: vi.fn(), update: vi.fn() },
  stamp: { deleteMany: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { PATCH } from "./route";

const STUDIO_ID = "6a00000000000000000000aa";
const APPT = "6a0000000000000000000a01";

const setStatus = (status: string) =>
  PATCH(
    new Request("http://test", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ id: APPT }) }
  );

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
  prismaMock.studio.findUnique.mockResolvedValue({
    id: STUDIO_ID,
    slug: "tangible",
    features: { rewards: true, publicBooking: true },
  });
  prismaMock.appointment.findUnique.mockResolvedValue({
    id: APPT,
    studioId: STUDIO_ID,
    status: "CONFIRMED",
    date: new Date("2026-10-13T22:00:00Z"),
    endDate: new Date("2026-10-13T23:00:00Z"),
  });
  prismaMock.appointment.update.mockImplementation(({ data }: { data: { status: string } }) =>
    Promise.resolve({ id: APPT, studioId: STUDIO_ID, status: data.status })
  );
  prismaMock.stamp.deleteMany.mockResolvedValue({ count: 1 });
});

describe("PATCH /api/appointments/[id] — sellos", () => {
  it("al cancelar, quita el sello sin gastar de esa cita", async () => {
    const res = await setStatus("CANCELLED");
    expect(res.status).toBe(200);
    expect(prismaMock.stamp.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ studioId: STUDIO_ID, dedupeKey: `appt:${APPT}` }),
    });
  });

  it("confirmar no toca los sellos", async () => {
    await setStatus("CONFIRMED");
    expect(prismaMock.stamp.deleteMany).not.toHaveBeenCalled();
  });
});
