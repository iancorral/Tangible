import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  customer: { findMany: vi.fn() },
  appointment: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { GET } from "./route";

const customers = [
  { id: "1", name: "Dania Peña", phone: "6142708576", createdAt: new Date("2026-08-08") },
  { id: "2", name: "Lucero Peña", phone: "6142894279", createdAt: new Date("2026-08-08") },
  { id: "3", name: "Sofía Chávez", phone: "6141428871", createdAt: new Date("2026-09-13") },
];

const search = async (q: string) => {
  const res = await GET(new Request(`http://test/api/admin/clients?q=${encodeURIComponent(q)}`));
  return ((await res.json()).clients as { name: string }[]).map((c) => c.name);
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { email: "admin@test" } });
  prismaMock.customer.findMany.mockResolvedValue(customers);
  prismaMock.appointment.groupBy.mockResolvedValue([]);
});

describe("GET /api/admin/clients?q=", () => {
  it("sin sesión responde 401", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await GET(new Request("http://test/api/admin/clients?q=dania"));
    expect(res.status).toBe(401);
  });

  it.each(["Dania Pena", "dania peña", "pena dania", "2708576"])("encuentra a Dania con %j", async (q) => {
    expect(await search(q)).toEqual(["Dania Peña"]);
  });

  it("busca sin acentos en todas las clientas", async () => {
    expect(await search("sofia")).toEqual(["Sofía Chávez"]);
    expect((await search("pena")).sort()).toEqual(["Dania Peña", "Lucero Peña"]);
  });
});
