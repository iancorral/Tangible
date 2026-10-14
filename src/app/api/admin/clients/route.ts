import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { normalizePhone } from "@/lib/phone";
import { foldText, matchesClient } from "@/lib/search";

/** Candidates pulled before ranking by last visit, so the top 8 are the real top 8. */
const SEARCH_CANDIDATES = 40;
const SEARCH_RESULTS = 8;

export async function GET(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const phone = searchParams.get("phone");

  if (q !== null) {
    const term = q.trim();
    if (term.length < 2) {
      return NextResponse.json({ clients: [] });
    }

    // Matched in memory so "Dania Pena" finds "Dania Peña" (see lib/search.ts).
    const all = await prisma.customer.findMany({
      where: { studioId },
      select: { id: true, name: true, phone: true, createdAt: true },
    });
    const customers = all.filter((c) => matchesClient(c, term)).slice(0, SEARCH_CANDIDATES);

    // Clientas de paso: se agendaron sin teléfono (señoras sin celular, gente que
    // va una vez), así que no tienen ficha. Igual se sugieren por nombre para no
    // obligar a escribirlas de nuevo si regresan. En MongoDB `null` no incluye
    // campos ausentes, de ahí los dos lados de cada OR.
    const phoneless = await prisma.appointment.findMany({
      where: {
        studioId,
        status: { not: "CANCELLED" },
        AND: [
          { OR: [{ customerId: null }, { customerId: { isSet: false } }] },
          { OR: [{ clientPhone: null }, { clientPhone: { isSet: false } }] },
        ],
      },
      select: { clientName: true, date: true },
    });
    const walkIns = new Map<string, { name: string; visits: number; lastVisit: Date }>();
    for (const appointment of phoneless) {
      if (!matchesClient({ name: appointment.clientName, phone: "" }, term)) continue;
      const key = foldText(appointment.clientName);
      const known = walkIns.get(key);
      if (!known) {
        walkIns.set(key, { name: appointment.clientName.trim(), visits: 1, lastVisit: appointment.date });
      } else {
        known.visits++;
        if (appointment.date > known.lastVisit) {
          known.lastVisit = appointment.date;
          known.name = appointment.clientName.trim();
        }
      }
    }
    // Si ya tiene ficha con ese mismo nombre, manda la ficha.
    const customerNames = new Set(customers.map((c) => foldText(c.name)));
    const walkInRows = [...walkIns.entries()]
      .filter(([key]) => !customerNames.has(key))
      .map(([, w]) => ({ name: w.name, phone: null, visits: w.visits, lastVisit: w.lastVisit }));

    if (customers.length === 0 && walkInRows.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    // Visit count and last visit come from the appointments, not from a stored
    // counter, so they can never drift away from the actual agenda.
    const stats = await prisma.appointment.groupBy({
      by: ["customerId"],
      where: {
        studioId,
        customerId: { in: customers.map((c) => c.id) },
        status: { not: "CANCELLED" },
      },
      _count: { _all: true },
      _max: { date: true },
    });

    const statsByCustomer = new Map(stats.map((s) => [s.customerId, s]));

    const clients = [
      ...customers.map((customer) => {
        const stat = statsByCustomer.get(customer.id);
        return {
          name: customer.name,
          phone: customer.phone as string | null,
          visits: stat?._count._all ?? 0,
          // A customer with no visits yet still sorts, just last.
          lastVisit: stat?._max.date ?? customer.createdAt,
        };
      }),
      ...walkInRows,
    ]
      .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
      .slice(0, SEARCH_RESULTS);

    return NextResponse.json({ clients });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return NextResponse.json({ appointments: [], total: 0 });
  }

  const customer = await prisma.customer.findUnique({
    where: { studioId_phone: { studioId, phone: normalized } },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ appointments: [], total: 0 });
  }

  const filters = { customerId: customer.id, status: { not: "CANCELLED" } };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: { studioId, ...filters },
      include: { services: true },
      orderBy: { date: "desc" },
      take: 3,
    }),
    prisma.appointment.count({ where: { studioId, ...filters } }),
  ]);

  return NextResponse.json({ appointments, total });
}
