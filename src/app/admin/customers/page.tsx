"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MuralDecorations from "@/components/layout/MuralDecorations";
import { SensitiveValue } from "@/components/privacy";
import { formatChihuahuaMonthShort, getChihuahuaParts } from "@/lib/timezone";

type CustomerRow = {
  id: string;
  name: string;
  maskedPhone: string;
  visits: number;
  lastVisit: string | null;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Search runs on the server so it matches phone digits the masked value hides.
  useEffect(() => {
    let cancelled = false;
    const query = term.trim();

    // Debounced, and the spinner only appears once the request actually starts —
    // flipping it in the effect body would re-render on every keystroke.
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/customers?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : { customers: [] }))
        .then((data) => {
          if (cancelled) return;
          setCustomers(data.customers ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term]);

  const totalVisits = useMemo(
    () => customers.reduce((total, c) => total + c.visits, 0),
    [customers]
  );

  return (
    <main className="min-h-[100dvh] px-4 pt-6 pb-8 sm:px-6 lg:px-10 lg:pt-10 relative bg-salon-bg">
      <MuralDecorations />

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="mb-8">
          <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
            Clientas
          </h1>
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-8 bg-salon-terracotta"></div>
            <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              {customers.length} registradas · {totalVisits} citas
            </p>
          </div>
        </header>

        <div className="mb-5 lg:max-w-md">
          <label htmlFor="customer-search" className="sr-only">
            Buscar clienta por nombre o teléfono
          </label>
          <input
            id="customer-search"
            type="search"
            inputMode="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full bg-white border-2 border-salon-olive/20 rounded-2xl px-4 py-3.5 text-sm text-salon-brown font-bold placeholder:text-salon-gray/60 placeholder:font-normal focus:outline-none focus:border-salon-olive/60 transition-colors shadow-sm"
          />
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-2 border-salon-olive/10 h-[76px] animate-pulse"
              />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-salon-gray/20 rounded-3xl">
            <p className="text-salon-gray font-bold text-sm uppercase">
              {term.trim() ? "Sin resultados" : "Aún no hay clientas"}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {customers.map((customer) => {
              const lastVisit = customer.lastVisit ? new Date(customer.lastVisit) : null;
              return (
                <li key={customer.id}>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="flex items-center gap-4 bg-white p-4 rounded-2xl border-2 border-salon-olive/20 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2 border-salon-olive/20 bg-salon-bg text-salon-brown shrink-0">
                      {lastVisit ? (
                        <>
                          <span className="text-[9px] uppercase tracking-wider">
                            {formatChihuahuaMonthShort(lastVisit)}
                          </span>
                          <span className="text-xl font-black">
                            {getChihuahuaParts(lastVisit).day}
                          </span>
                        </>
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider text-salon-gray font-bold text-center leading-tight">
                          Sin<br />citas
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="font-black text-salon-brown uppercase tracking-wide truncate">
                        {customer.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <SensitiveValue className="text-[10px] text-salon-gray font-bold tabular-nums">
                          {customer.maskedPhone}
                        </SensitiveValue>
                        <span className="text-[10px] text-salon-gray">·</span>
                        <span className="text-[10px] text-salon-olive font-bold">
                          {customer.visits} {customer.visits === 1 ? "cita" : "citas"}
                        </span>
                      </div>
                    </div>

                    <span className="text-salon-gray text-lg shrink-0" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
