"use client";

import { useState, useEffect } from "react";
import { PrivacyToggle, SensitiveAmount } from "@/components/privacy";

type Metrics = {
  period: string;
  totalConfirmed: number;
  totalCancelled: number;
  freeCount: number;
  chargedCount: number;
  revenue: number;
  avgTicket: number;
  topService: { name: string; count: number } | null;
  avgDuration: number;
};

/** "row": 4 tarjetas en fila (pantalla completa). "rail": 2×2 para la columna lateral. */
export default function MetricsDashboard({ layout = "row" }: { layout?: "row" | "rail" }) {
  const grid = layout === "rail" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4";
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");

  const loading = !metrics || metrics.period !== period;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/metrics?period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMetrics(data);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className={layout === "rail" ? "" : "mb-8"}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-black text-salon-olive uppercase tracking-widest">
          Resumen
        </h2>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <div className="flex gap-1 bg-white border-2 border-salon-olive/20 rounded-2xl p-1 shadow-sm">
            <button
              onClick={() => setPeriod("week")}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${period === "week" ? "bg-salon-olive text-white shadow-sm" : "text-salon-gray hover:text-salon-olive"}`}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${period === "month" ? "bg-salon-olive text-white shadow-sm" : "text-salon-gray hover:text-salon-olive"}`}
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={grid}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border-2 border-salon-olive/10 p-4 md:p-5 animate-pulse h-24 md:h-28" />
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className={grid}>
            <a
              href={`/admin/revenue?period=${period}`}
              className="bg-white rounded-3xl border-2 border-salon-olive/20 p-4 md:p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group block"
            >
              <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">Ingresos</p>
              <SensitiveAmount
                value={metrics.revenue}
                className="block text-2xl md:text-3xl font-black text-salon-olive"
              />
              <p className="text-[10px] text-salon-olive/60 mt-1 font-bold group-hover:text-salon-olive transition-colors">
                ver desglose →
              </p>
            </a>

            <div className="bg-white rounded-3xl border-2 border-salon-brown/20 p-4 md:p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">Citas</p>
              <p className="text-2xl md:text-3xl font-black text-salon-brown">{metrics.totalConfirmed}</p>
              {/* Cancellations no longer own a card, but stay visible as context. */}
              <p className="text-[10px] text-salon-gray mt-1 font-medium">
                confirmadas
                {metrics.totalCancelled > 0 && (
                  <span className="opacity-70"> · {metrics.totalCancelled} cancelada{metrics.totalCancelled !== 1 ? "s" : ""}</span>
                )}
              </p>
            </div>

            <div className="bg-white rounded-3xl border-2 border-salon-terracotta/20 p-4 md:p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">Ticket promedio</p>
              {metrics.chargedCount > 0 ? (
                <>
                  <SensitiveAmount
                    value={metrics.avgTicket}
                    className="block text-2xl md:text-3xl font-black text-salon-terracotta"
                  />
                  <p className="text-[10px] text-salon-gray mt-1 font-medium">
                    por cita cobrada
                    {metrics.freeCount > 0 && (
                      <span className="opacity-70"> · {metrics.freeCount} gratis</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-salon-gray font-bold mt-2">Sin datos</p>
              )}
            </div>


            <div className="bg-white rounded-3xl border-2 border-salon-lavender/30 p-4 md:p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">Top servicio</p>
              {metrics.topService ? (
                <div className="flex flex-col justify-center h-full pb-3">
                  <p className="text-sm font-black text-salon-lavender leading-tight line-clamp-2">{metrics.topService.name}</p>
                  <p className="text-[10px] text-salon-gray mt-1 font-bold">{metrics.topService.count} veces</p>
                </div>
              ) : (
                <p className="text-sm text-salon-gray font-bold mt-2">Sin datos</p>
              )}
            </div>
          </div>

        </>
      ) : null}
    </div>
  );
}
