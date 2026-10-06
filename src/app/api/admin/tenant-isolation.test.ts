/**
 * Dos estudios en la misma base: Tania (Tangible) y Alejandra (iLoveMe).
 * Con la sesión de una, los datos de la otra no existen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const TANGIBLE = { id: "6a00000000000000000000aa", slug: "tangible", name: "Tangible", shortName: "Tangible", logoPath: null, features: { rewards: true, publicBooking: true } };
const ILOVEME = { id: "6a00000000000000000000bb", slug: "iloveme", name: "iLoveMe Beauty Salon", shortName: "iLoveMe", logoPath: "/studios/iloveme/logo.png", features: { rewards: false, publicBooking: false } };
const TANIA_NOTE = "6a0000000000000000000c01";

const prismaMock = vi.hoisted(() => ({
  studio: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  note: { findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  workSchedule: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { PATCH as patchNote, DELETE as deleteNote } from "./notes/[id]/route";
import { POST as saveSchedule } from "./schedule/route";
import { GET as rewardsProgram } from "./rewards/program/route";

const signInAs = (studio: typeof TANGIBLE, withStudioInToken = true) => {
  sessionMock.mockResolvedValue({
    user: { id: `user-${studio.slug}`, email: `${studio.slug}@test`, name: "Test", ...(withStudioInToken ? { studioId: studio.id } : {}) },
  });
  prismaMock.studio.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve([TANGIBLE, ILOVEME].find((s) => s.id === where.id) ?? null)
  );
};

const json = (body: unknown, method = "PATCH") =>
  new Request("http://test", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

// La base simulada respeta el filtro: solo devuelve la nota si el studioId coincide.
const notFound = () => new Prisma.PrismaClientKnownRequestError("No record", { code: "P2025", clientVersion: "test" });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.note.findUnique.mockImplementation(({ where }: { where: { id: string; studioId: string } }) =>
    Promise.resolve(where.id === TANIA_NOTE && where.studioId === TANGIBLE.id ? { id: TANIA_NOTE, studioId: TANGIBLE.id, title: "Fisio", body: "", items: [] } : null)
  );
  prismaMock.note.update.mockImplementation(({ where }: { where: { studioId: string } }) =>
    where.studioId === TANGIBLE.id ? Promise.resolve({}) : Promise.reject(notFound())
  );
  prismaMock.note.deleteMany.mockImplementation(({ where }: { where: { studioId: string } }) =>
    Promise.resolve({ count: where.studioId === TANGIBLE.id ? 1 : 0 })
  );
});

describe("aislamiento entre Tangible e iLoveMe", () => {
  it("Alejandra no puede editar una nota de Tania", async () => {
    signInAs(ILOVEME);
    const res = await patchNote(json({ title: "hackeada" }), params(TANIA_NOTE));
    expect(res.status).toBe(404);
    expect(prismaMock.note.update).not.toHaveBeenCalled();
    expect(prismaMock.note.findUnique.mock.calls[0][0].where).toEqual({ id: TANIA_NOTE, studioId: ILOVEME.id });
  });

  it("Alejandra no puede borrar una nota de Tania", async () => {
    signInAs(ILOVEME);
    const res = await deleteNote(new Request("http://test", { method: "DELETE" }), params(TANIA_NOTE));
    expect(res.status).toBe(404);
    expect(prismaMock.note.deleteMany.mock.calls[0][0].where).toEqual({ id: TANIA_NOTE, studioId: ILOVEME.id });
  });

  it("Tania sí puede borrar su propia nota", async () => {
    signInAs(TANGIBLE);
    const res = await deleteNote(new Request("http://test", { method: "DELETE" }), params(TANIA_NOTE));
    expect(res.status).toBe(200);
  });

  it("guardar el horario de Alejandra solo reemplaza el suyo", async () => {
    signInAs(ILOVEME);
    const week = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: "10:00", endTime: "19:00", isDayOff: dayOfWeek === 0 }));
    const res = await saveSchedule(json(week, "POST"));
    expect(res.status).toBe(200);
    expect(prismaMock.workSchedule.deleteMany).toHaveBeenCalledWith({ where: { studioId: ILOVEME.id } });
    const created = prismaMock.workSchedule.createMany.mock.calls[0][0].data as { studioId: string }[];
    expect(created.every((d) => d.studioId === ILOVEME.id)).toBe(true);
  });

  it("Premios está apagado para iLoveMe", async () => {
    signInAs(ILOVEME);
    const res = await rewardsProgram();
    expect(res.status).toBe(403);
  });

  it("una sesión de antes de los estudios sigue funcionando (sin cerrar sesión)", async () => {
    signInAs(TANGIBLE, false);
    prismaMock.user.findUnique.mockResolvedValue({ studioId: TANGIBLE.id });
    const res = await deleteNote(new Request("http://test", { method: "DELETE" }), params(TANIA_NOTE));
    expect(res.status).toBe(200);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-tangible" }, select: { studioId: true } });
  });

  it("sin sesión no hay acceso", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await deleteNote(new Request("http://test", { method: "DELETE" }), params(TANIA_NOTE));
    expect(res.status).toBe(401);
  });
});
