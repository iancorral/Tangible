import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  service: { findMany: vi.fn() },
  appointment: { findFirst: vi.fn(), create: vi.fn() },
  customer: { findUnique: vi.fn(), create: vi.fn() },
}));
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));

import { POST } from "./route";

const SERVICE = "6a0000000000000000000001";
const DATE = "2030-03-12T22:00:00.000Z";

const request = (body: unknown) =>
  new Request("http://test/api/admin/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = { clientName: "Dania Peña", clientPhone: "614 270 8576", serviceIds: [SERVICE], date: DATE };

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { email: "admin@test" } });
  prismaMock.service.findMany.mockResolvedValue([{ id: SERVICE, duration: 60 }]);
  prismaMock.appointment.findFirst.mockResolvedValue(null);
  prismaMock.customer.findUnique.mockResolvedValue({ id: "cust-dania" });
  prismaMock.appointment.create.mockImplementation(({ data }) => Promise.resolve({ id: "new", ...data }));
});

describe("POST /api/admin/appointments", () => {
  it("sin sesión responde 401 y no toca la base", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await POST(request(validBody));
    expect(res.status).toBe(401);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("acepta nombre y teléfono copiados de Contactos en iOS (caso Dania)", async () => {
    const res = await POST(
      request({ ...validBody, clientName: "‪Dania Peña 💅‬", clientPhone: "‪+52 1 614 270 8576‬" })
    );
    expect(res.status).toBe(201);
    const { data } = prismaMock.appointment.create.mock.calls[0][0];
    expect(data.clientName).toBe("Dania Peña");
    expect(data.clientPhone).toBe("6142708576");
    expect(data.customerId).toBe("cust-dania");
  });

  it("sin teléfono crea la cita sin vincular clienta", async () => {
    const res = await POST(request({ ...validBody, clientPhone: "" }));
    expect(res.status).toBe(201);
    const { data } = prismaMock.appointment.create.mock.calls[0][0];
    expect(data.clientPhone).toBeNull();
    expect(data.customerId).toBeNull();
  });

  it("explica en español qué campo corregir", async () => {
    const res = await POST(request({ ...validBody, clientName: "A", clientPhone: "123" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Revisa los datos de la cita",
      fields: { clientName: "El nombre es muy corto", clientPhone: "El teléfono debe tener 10 dígitos" },
    });
  });

  it("un reintento por mala señal devuelve la misma cita en vez de duplicarla", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "existing", serviceIDs: [SERVICE] });
    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("existing");
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("la misma hora con otros servicios sí es una cita nueva", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "existing", serviceIDs: ["6a0000000000000000000002"] });
    const res = await POST(request(validBody));
    expect(res.status).toBe(201);
  });
});
