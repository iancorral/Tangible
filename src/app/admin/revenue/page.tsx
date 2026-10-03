"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MuralDecorations from "@/components/layout/MuralDecorations";
import FreeTag from "@/components/admin/FreeTag";
import { PrivacyToggle, SensitiveAmount } from "@/components/privacy";
import { MONETARY_BUCKETS, REVENUE_BUCKETS, RevenueBucket } from "@/lib/pricing";

type Entry = {
  id: string;
  date: string;
  dateLabel: string;
  bucket: RevenueBucket;
  paymentStatus: string;
  amount: number;
};

type RevenueData = {
  period: string;
  offset: number;
  periodLabel: string;
  entries: Entry[];
  summary: Record<RevenueBucket, number>;
  grandTotal: number;
  completedCount: number;
  freeCount: number;
};

const BUCKET_CONFIG: Record<RevenueBucket, { label: string; color: string; border: string; text: string }> = {
  CASH:     { label: "Efectivo",       color: "bg-emerald-50",          border: "border-emerald-200",        text: "text-emerald-700"    },
  TRANSFER: { label: "Transferencia",  color: "bg-blue-50",             border: "border-blue-200",           text: "text-blue-700"       },
  CARD:     { label: "Tarjeta",        color: "bg-violet-50",           border: "border-violet-200",         text: "text-violet-700"     },
  PENDING:  { label: "Sin registrar",  color: "bg-salon-mustard-50",            border: "border-salon-mustard-200",          text: "text-salon-mustard-700"      },
  FREE:     { label: "Gratis",         color: "bg-salon-lavender/10",   border: "border-salon-lavender/30",  text: "text-salon-lavender" },
};

const STATUS_LABEL: Record<string, string> = {
  PAID:    "Pagado",
  PARTIAL: "Parcial",
  PENDING: "Pendiente",
};

function RevenueContent() {
  const searchParams = useSearchParams();
  const initialPeriod = (searchParams.get("period") ?? "week") as "week" | "month";

  const [period, setPeriod] = useState<"week" | "month">(initialPeriod);
  // offset: 0 = periodo actual, -1 = anterior, etc. (nunca positivo: no hay futuro).
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RevenueData | null>(null);

  // Carga derivada: el esqueleto se muestra mientras los datos cargados no
  // correspondan al periodo/offset seleccionado (evita setState síncrono en el efecto).
  const loading = !data || data.period !== period || data.offset !== offset;

  // Cambiar de semana↔mes vuelve al periodo actual.
  const changePeriod = (next: "week" | "month") => {
    setPeriod(next);
    setOffset(0);
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/revenue?period=${period}&offset=${offset}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      });
    return () => {
      cancelled = true;
    };
  }, [period, offset]);

  const groups = REVENUE_BUCKETS.map((bucket) => ({
    bucket,
    ...BUCKET_CONFIG[bucket],
    entries: data?.entries.filter((e) => e.bucket === bucket) ?? [],
    total: data?.summary[bucket] ?? 0,
  }));

  return (
    <main className="min-h-[100dvh] p-4 md:p-10 bg-salon-bg relative">
      <MuralDecorations />
      <div className="max-w-2xl mx-auto relative z-10">

        <header className="mb-8">
          <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
            Ingresos
          </h1>
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-8 bg-salon-terracotta" />
            <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              Desglose por método de pago
            </p>
          </div>
        </header>

        {/* Period selector */}
        <div className="flex items-center justify-between mb-4">
          <PrivacyToggle />
          <div className="flex gap-1 bg-white border-2 border-salon-olive/20 rounded-2xl p-1 shadow-sm">
            <button
              onClick={() => changePeriod("week")}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${period === "week" ? "bg-salon-olive text-white shadow-sm" : "text-salon-gray hover:text-salon-olive"}`}
            >
              Semana
            </button>
            <button
              onClick={() => changePeriod("month")}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${period === "month" ? "bg-salon-olive text-white shadow-sm" : "text-salon-gray hover:text-salon-olive"}`}
            >
              Mes
            </button>
          </div>
        </div>

        {/* Historical navigation */}
        <div className="flex items-center justify-between mb-6 bg-white border-2 border-salon-olive/20 rounded-2xl p-1.5 shadow-sm">
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label={period === "week" ? "Semana anterior" : "Mes anterior"}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-salon-brown hover:bg-salon-olive/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-xs font-black text-salon-brown uppercase tracking-widest">
              {data?.periodLabel ?? "—"}
            </p>
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                className="text-[9px] font-bold text-salon-terracotta uppercase tracking-wider hover:underline"
              >
                Volver al actual
              </button>
            )}
          </div>

          <button
            onClick={() => setOffset((o) => Math.min(o + 1, 0))}
            disabled={offset >= 0}
            aria-label={period === "week" ? "Semana siguiente" : "Mes siguiente"}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-salon-brown hover:bg-salon-olive/10 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-salon-olive/10 p-5 animate-pulse h-36" />
            ))}
          </div>
        ) : (
          <>
            {/* Appointments actually held in the period: free ones included,
                cancelled ones excluded. Counts are not sensitive, so they stay
                visible while privacy mode is on. */}
            <div className="mb-4 bg-white rounded-2xl border-2 border-salon-olive/20 shadow-sm px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-salon-gray">
                  Citas completadas
                </p>
                <p className="text-[10px] text-salon-gray font-medium mt-0.5">
                  Sin contar canceladas
                  {(data?.freeCount ?? 0) > 0 && ` · ${data?.freeCount} gratis`}
                </p>
              </div>
              <p className="text-2xl font-black text-salon-brown shrink-0 tabular-nums">
                {data?.completedCount ?? 0}
              </p>
            </div>

            <div className="space-y-4">
              {groups.map(({ bucket, label, color, border, text, entries, total }) => {
                if (entries.length === 0) return null;
                const isFree = bucket === "FREE";
                return (
                  <section key={bucket} className={`rounded-2xl border-2 ${border} ${color} overflow-hidden`}>
                    {/* Group header — a free group has no total worth showing,
                        so it reports how many appointments it holds instead. */}
                    <div className={`flex items-center justify-between px-5 py-3 border-b ${border}`}>
                      <span className={`text-xs font-black uppercase tracking-widest ${text}`}>{label}</span>
                      {isFree ? (
                        <span className={`text-xs font-black uppercase tracking-widest ${text}`}>
                          {entries.length} cita{entries.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <SensitiveAmount value={total} className={`text-base font-black ${text}`} />
                      )}
                    </div>

                    {/* Entries */}
                    <div className="divide-y divide-white/60">
                      {entries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-bold text-salon-brown capitalize truncate">{entry.dateLabel}</span>
                            {/* A payment status is meaningless with nothing to collect. */}
                            {!isFree && (
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                entry.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : entry.paymentStatus === "PARTIAL"
                                  ? "bg-salon-mustard-100 text-salon-mustard-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}>
                                {STATUS_LABEL[entry.paymentStatus] ?? entry.paymentStatus}
                              </span>
                            )}
                          </div>
                          {isFree ? (
                            <FreeTag className="shrink-0" />
                          ) : (
                            <SensitiveAmount value={entry.amount} className="text-sm font-black text-salon-brown shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {data?.entries.length === 0 && (
                <div className="text-center py-16 text-salon-gray text-xs uppercase tracking-widest">
                  Sin citas en este período
                </div>
              )}
            </div>

            {/* Grand total */}
            {(data?.grandTotal ?? 0) > 0 && (
              <div className="mt-6 bg-white rounded-2xl border-2 border-salon-olive/30 shadow-sm px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-salon-gray">Total general</p>
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {MONETARY_BUCKETS.map((bucket) =>
                      (data?.summary[bucket] ?? 0) > 0 ? (
                        <span key={bucket} className={`text-[10px] font-bold ${BUCKET_CONFIG[bucket].text}`}>
                          {BUCKET_CONFIG[bucket].label}:{" "}
                          <SensitiveAmount value={data?.summary[bucket] ?? 0} />
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
                <SensitiveAmount
                  value={data?.grandTotal ?? 0}
                  className="text-3xl font-black text-salon-olive"
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function RevenuePage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-salon-bg" />}>
      <RevenueContent />
    </Suspense>
  );
}
