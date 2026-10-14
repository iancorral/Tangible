/** Estado de activación que el diálogo del QR consulta mientras espera. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  customer: { findUnique: vi.fn() },
  claimCode: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { GET, POST } from "./route";

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

describe("POST /api/admin/rewards/claim-code", () => {
  const issue = async (body: Record<string, unknown>) => {
    const res = await POST(
      new Request("http://test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    );
    return { status: res.status, body: await res.json() };
  };
  const minutesLeft = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 60000);

  beforeEach(() => {
    process.env.REWARDS_PASS_SECRET = "test-secret";
    prismaMock.customer.findUnique.mockResolvedValue({ id: CUSTOMER, phone: "6141749818" });
    prismaMock.claimCode.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.claimCode.create.mockResolvedValue({});
  });

  it("QR: dura 30 minutos, no manda el teléfono y no anula un enlace ya enviado", async () => {
    const { status, body } = await issue({ customerId: CUSTOMER });
    expect(status).toBe(200);
    expect(body.code).toMatch(/^[0-9A-Z]{6}$/);
    expect(body.phone).toBeUndefined();
    expect(minutesLeft(body.expiresAt)).toBe(30);
    // Solo anula códigos cortos (otros QR), no el enlace de 24 h.
    const { where } = prismaMock.claimCode.updateMany.mock.calls[0][0];
    expect(where).toMatchObject({ studioId: STUDIO_ID, customerId: CUSTOMER, consumedAt: null });
    expect(where.expiresAt.lte.getTime()).toBeLessThan(Date.now() + 60 * 60 * 1000);
  });

  it("enlace por WhatsApp: dura 24 h, trae su teléfono y reemplaza cualquier código anterior", async () => {
    const { body } = await issue({ customerId: CUSTOMER, delivery: "link" });
    expect(minutesLeft(body.expiresAt)).toBe(24 * 60);
    expect(body.phone).toBe("6141749818");
    const { where } = prismaMock.claimCode.updateMany.mock.calls[0][0];
    expect(where).toEqual({ studioId: STUDIO_ID, customerId: CUSTOMER, consumedAt: null });
  });

  it("solo guarda el hash del código, nunca el código", async () => {
    const { body } = await issue({ customerId: CUSTOMER, delivery: "link" });
    const { data } = prismaMock.claimCode.create.mock.calls[0][0];
    expect(data.studioId).toBe(STUDIO_ID);
    expect(JSON.stringify(data)).not.toContain(body.code);
  });

  it("modo desconocido: 400", async () => {
    expect((await issue({ customerId: CUSTOMER, delivery: "sms" })).status).toBe(400);
  });
});
