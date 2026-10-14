/** Estado de activación que el diálogo del QR consulta mientras espera. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  customer: { findUnique: vi.fn() },
  claimCode: { findFirst: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { GET } from "./route";

const STUDIO_ID = "6a00000000000000000000aa";
const CUSTOMER = "6a0000000000000000000c01";
const studio = (rewards: boolean) => ({
  id: STUDIO_ID,
  slug: "tangible",
  name: "Tangible",
  shortName: "Tangible",
  logoPath: null,
  features: { rewards, publicBooking: true },
});
const status = (customerId = CUSTOMER) =>
  GET(new Request(`http://test/api/admin/rewards/claim-code?customerId=${customerId}`));

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
  prismaMock.customer.findUnique.mockResolvedValue({ joinedAt: null });
  prismaMock.claimCode.findFirst.mockResolvedValue(null);
});

describe("GET /api/admin/rewards/claim-code?customerId=", () => {
  it("sin activar todavía", async () => {
    const res = await status();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enrolled: false, lastActivatedAt: null });
  });

  it("activada: devuelve cuándo usó su último código", async () => {
    const consumedAt = new Date("2026-10-13T18:00:00Z");
    prismaMock.customer.findUnique.mockResolvedValue({ joinedAt: new Date("2026-08-08") });
    prismaMock.claimCode.findFirst.mockResolvedValue({ consumedAt });
    expect(await (await status()).json()).toEqual({ enrolled: true, lastActivatedAt: consumedAt.toISOString() });
  });

  it("solo mira clientas y códigos de su propio estudio", async () => {
    await status();
    expect(prismaMock.customer.findUnique.mock.calls[0][0].where).toEqual({ id: CUSTOMER, studioId: STUDIO_ID });
    expect(prismaMock.claimCode.findFirst.mock.calls[0][0].where).toMatchObject({
      studioId: STUDIO_ID,
      customerId: CUSTOMER,
    });
  });

  it("clienta de otro estudio o inexistente: 404", async () => {
    prismaMock.customer.findUnique.mockResolvedValue(null);
    expect((await status()).status).toBe(404);
  });

  it("id inválido: 400; sin sesión: 401; sin Premios: 403", async () => {
    expect((await status("nope")).status).toBe(400);
    sessionMock.mockResolvedValueOnce(null);
    expect((await status()).status).toBe(401);
    prismaMock.studio.findUnique.mockResolvedValue(studio(false));
    expect((await status()).status).toBe(403);
  });
});
