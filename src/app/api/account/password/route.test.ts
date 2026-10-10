import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const STUDIO = { id: "6a00000000000000000000bb", slug: "iloveme", name: "iLoveMe Beauty Salon", shortName: "iLoveMe", logoPath: null, features: { rewards: false, publicBooking: false } };

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { POST } from "./route";

const TEMP = "temporal-123";
let tempHash: string;

const post = (body: unknown) =>
  POST(new Request("http://test/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(async () => {
  vi.clearAllMocks();
  tempHash ??= await bcrypt.hash(TEMP, 4);
  sessionMock.mockResolvedValue({ user: { id: "user-ale", email: "alejandra@tangible.com", studioId: STUDIO.id, issuedAt: Math.floor(Date.now() / 1000) } });
  prismaMock.studio.findUnique.mockResolvedValue(STUDIO);
  // getPanelSession lee la cuenta; la ruta vuelve a leerla para comparar la contraseña.
  prismaMock.user.findUnique.mockImplementation(({ select }: { select: Record<string, boolean> }) =>
    Promise.resolve(
      select.password
        ? { password: tempHash }
        : { studioId: STUDIO.id, email: "alejandra@tangible.com", name: "Alejandra", mustChangePassword: true, passwordChangedAt: null }
    )
  );
  prismaMock.user.update.mockResolvedValue({});
});

describe("POST /api/account/password", () => {
  it("funciona con la contraseña temporal y la deja de pedir", async () => {
    const res = await post({ current: TEMP, next: "mi-clave-privada", confirm: "mi-clave-privada" });
    expect(res.status).toBe(200);
    const { where, data } = prismaMock.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: "user-ale" });
    expect(data.mustChangePassword).toBe(false);
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
    // Se guarda el hash, nunca el texto.
    expect(data.password).not.toBe("mi-clave-privada");
    expect(await bcrypt.compare("mi-clave-privada", data.password)).toBe(true);
  });

  it("rechaza si la contraseña actual no es correcta", async () => {
    const res = await post({ current: "otra-cosa", next: "mi-clave-privada", confirm: "mi-clave-privada" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/actual no es correcta/);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ current: TEMP, next: "corta", confirm: "corta" }, /al menos 10/],
    [{ current: TEMP, next: "mi-clave-privada", confirm: "otra-clave-xx" }, /no coinciden/],
    [{ current: TEMP, next: TEMP, confirm: TEMP }, /distinta/],
  ])("explica qué falta: %j", async (body, message) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(message);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("sin sesión no hace nada", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await post({ current: TEMP, next: "mi-clave-privada", confirm: "mi-clave-privada" });
    expect(res.status).toBe(401);
  });
});
