import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  customer: { findMany: vi.fn() },
  appointment: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { GET } from "./route";

const STUDIO_ID = "6a00000000000000000000aa";
const STUDIO = { id: STUDIO_ID, slug: "tangible", name: "Tangible", shortName: "Tangible", logoPath: null, features: { rewards: true, publicBooking: true } };


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
  sessionMock.mockResolvedValue({ user: { id: "user-tania", email: "tania@test", name: "Tania", studioId: STUDIO_ID } });
  prismaMock.studio.findUnique.mockResolvedValue(STUDIO);
  prismaMock.user.findUnique.mockResolvedValue({ studioId: STUDIO_ID, email: "tania@test", name: "Tania", mustChangePassword: false, passwordChangedAt: null });
  prismaMock.customer.findMany.mockResolvedValue(customers);
  prismaMock.appointment.groupBy.mockResolvedValue([]);
  prismaMock.appointment.findMany.mockResolvedValue([]);
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

describe("clientas de paso (sin teléfono)", () => {
  const walkIns = [
    { clientName: "Doña Chuy", date: new Date("2026-09-01") },
    { clientName: "doña chuy ", date: new Date("2026-10-05") },
    { clientName: "Dania Peña", date: new Date("2026-07-01") },
  ];

  const searchRows = async (q: string) => {
    const res = await GET(new Request(`http://test/api/admin/clients?q=${encodeURIComponent(q)}`));
    return (await res.json()).clients as { name: string; phone: string | null; visits: number }[];
  };

  beforeEach(() => {
    prismaMock.appointment.findMany.mockResolvedValue(walkIns);
  });

  it("aparecen por nombre, sin teléfono y con sus visitas juntas", async () => {
    expect(await searchRows("chuy")).toEqual([
      expect.objectContaining({ name: "doña chuy", phone: null, visits: 2 }),
    ]);
    expect((await searchRows("dona")).map((c) => c.name)).toEqual(["doña chuy"]);
  });

  it("solo busca citas del estudio, sin ficha, sin teléfono y no canceladas", async () => {
    await searchRows("chuy");
    const { where } = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(where.studioId).toBe(STUDIO_ID);
    expect(where.status).toEqual({ not: "CANCELLED" });
    expect(JSON.stringify(where.AND)).toContain("customerId");
    expect(JSON.stringify(where.AND)).toContain("clientPhone");
  });

  it("si ya tiene ficha con ese nombre, se sugiere la ficha y no se repite", async () => {
    const rows = await searchRows("dania");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Dania Peña", phone: "6142708576" });
  });
});
