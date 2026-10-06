import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { normalizePhone } from "@/lib/phone";
import { matchesClient } from "@/lib/search";

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

    if (customers.length === 0) {
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

    const clients = customers
      .map((customer) => {
        const stat = statsByCustomer.get(customer.id);
        return {
          name: customer.name,
          phone: customer.phone,
          visits: stat?._count._all ?? 0,
          // A customer with no visits yet still sorts, just last.
          lastVisit: stat?._max.date ?? customer.createdAt,
        };
      })
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
