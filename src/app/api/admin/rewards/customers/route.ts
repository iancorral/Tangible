import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasFeature, requireStudio } from "@/lib/tenant";
import { maskPhone } from "@/lib/phone";
import { UNSPENT_STAMP } from "@/lib/rewards";
import { getRewardProgram } from "@/lib/rewards.server";
import type { Prisma } from "@prisma/client";

const MAX_CUSTOMERS = 300;

export async function GET(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  const term = (new URL(req.url).searchParams.get("q") ?? "").trim();

  const where: Prisma.CustomerWhereInput = {};
  if (term.length >= 2) {
    const digits = term.replace(/\D/g, "");
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ];
  }

  const [program, customers, unspent] = await Promise.all([
    getRewardProgram(studioId),
    prisma.customer.findMany({
      where: { studioId, ...where },
      take: MAX_CUSTOMERS,
      select: { id: true, name: true, phone: true },
    }),
    // Balances for everyone in one pass. The totals below are studio-wide and
    // deliberately not filtered by the search term: an outstanding-rewards
    // figure that shrinks as you type would be worse than useless.
    prisma.stamp.groupBy({
      by: ["customerId"],
      where: { studioId, ...UNSPENT_STAMP },
      _count: { _all: true },
    }),
  ]);

  const balances = new Map(unspent.map((row) => [row.customerId, row._count._all]));

  const rows = customers
    .map((customer) => {
      const stamps = balances.get(customer.id) ?? 0;
      return {
        id: customer.id,
        name: customer.name,
        maskedPhone: maskPhone(customer.phone),
        stamps,
        ready: stamps >= program.stampsRequired,
      };
    })
    .sort((a, b) => b.stamps - a.stamps || a.name.localeCompare(b.name, "es"));

  const totalStamps = unspent.reduce((total, row) => total + row._count._all, 0);

  return NextResponse.json({
    program,
    customers: rows,
    totals: {
      withStamps: unspent.length,
      totalStamps,
      // The liability: rewards already earned and waiting to be handed over.
      readyToRedeem: unspent.filter(
        (row) => row._count._all >= program.stampsRequired
      ).length,
    },
  });
}
