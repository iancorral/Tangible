import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { getAppointmentAmount, isFreeAmount } from "@/lib/pricing";

export async function GET(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "week";

  const now = new Date();
  const start = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const end = period === "week" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);

  const appointments = await prisma.appointment.findMany({
    where: { studioId, date: { gte: start, lte: end } },
    include: { services: true },
  });

  const confirmed = appointments.filter((a) => a.status === "CONFIRMED");
  const cancelled = appointments.filter((a) => a.status === "CANCELLED");

  // Free appointments count as appointments but contribute $0 to revenue, so
  // they are excluded from the average ticket to avoid diluting it.
  const amounts = confirmed.map(getAppointmentAmount);
  const revenue = amounts.reduce((acc, amount) => acc + amount, 0);
  const chargedCount = amounts.filter((amount) => !isFreeAmount(amount)).length;
  const freeCount = amounts.length - chargedCount;
  const avgTicket = chargedCount > 0 ? Math.round(revenue / chargedCount) : 0;

  const serviceCount: Record<string, { name: string; count: number }> = {};
  confirmed.forEach((app) => {
    app.services.forEach((svc) => {
      if (!serviceCount[svc.id]) serviceCount[svc.id] = { name: svc.name, count: 0 };
      serviceCount[svc.id].count++;
    });
  });

  const topService = Object.values(serviceCount).sort((a, b) => b.count - a.count)[0] ?? null;

  const avgDuration =
    confirmed.length > 0
      ? Math.round(
          confirmed.reduce((acc, app) => {
            return acc + app.services.reduce((s, svc) => s + svc.duration, 0);
          }, 0) / confirmed.length
        )
      : 0;

  return NextResponse.json({
    period,
    totalConfirmed: confirmed.length,
    // Cancellations are still tracked; they just no longer own a KPI card.
    totalCancelled: cancelled.length,
    freeCount,
    chargedCount,
    revenue,
    avgTicket,
    topService,
    avgDuration,
  });
}
