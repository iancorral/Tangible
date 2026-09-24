"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MuralDecorations from "@/components/layout/MuralDecorations";
import { REWARD_TYPES, type RewardType } from "@/lib/rewards";

type Program = {
  isActive: boolean;
  stampsRequired: number;
  rewardType: string;
  rewardValue: number;
  maxRewardValue: number | null;
  rewardLabel: string;
  termsNote: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  maskedPhone: string;
  stamps: number;
  ready: boolean;
};

type Totals = { withStamps: number; totalStamps: number; readyToRedeem: number };

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  PERCENT_DISCOUNT: "Descuento en %",
  FIXED_AMOUNT: "Descuento fijo en $",
  FREE_SERVICE: "Servicio gratis",
};

/** Row of stamp pips. Text carries the count too, so it never relies on colour. */
function StampDots({ filled, total }: { filled: number; total: number }) {
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`${filled} de ${total} sellos`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`w-2 h-2 rounded-full ${
            i < filled ? "bg-salon-brown" : "bg-salon-olive/20"
          }`}
        />
      ))}
    </span>
  );
}

export default function RewardsPage() {
  const [program, setProgram] = useState<Program | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Program | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/admin/rewards/customers?q=${encodeURIComponent(query)}`);
    if (!res.ok) return;
    const data = await res.json();
    setProgram(data.program);
    setCustomers(data.customers ?? []);
    setTotals(data.totals);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = term.trim();

    const timeout = setTimeout(() => {
      setLoading(true);
      load(query)
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term, load]);

  const adjust = useCallback(
    async (customerId: string, action: "ADD" | "REMOVE") => {
      setBusyId(customerId);
      setStatus(null);
      try {
        const res = await fetch("/api/admin/rewards/stamps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, action }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus({ kind: "error", message: data.error ?? "No se pudo ajustar" });
          return;
        }
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId ? { ...c, stamps: data.stamps, ready: data.ready } : c
          )
        );
        await load(term.trim());
      } catch {
        setStatus({ kind: "error", message: "Error de conexión" });
      } finally {
        setBusyId(null);
      }
    },
    [load, term]
  );

  const redeem = useCallback(
    async (customer: CustomerRow) => {
      if (!window.confirm(`¿Canjear la recompensa de ${customer.name}?`)) return;

      setBusyId(customer.id);
      setStatus(null);
      try {
        const res = await fetch("/api/admin/rewards/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: customer.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus({ kind: "error", message: data.error ?? "No se pudo canjear" });
          return;
        }
        setStatus({ kind: "ok", message: `Recompensa entregada a ${customer.name}` });
        await load(term.trim());
      } catch {
        setStatus({ kind: "error", message: "Error de conexión" });
      } finally {
        setBusyId(null);
      }
    },
    [load, term]
  );

  const saveProgram = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!draft) return;
      setStatus(null);

      try {
        const res = await fetch("/api/admin/rewards/program", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus({ kind: "error", message: data.error ?? "No se pudo guardar" });
          return;
        }
        setProgram(data);
        setEditing(false);
        setStatus({ kind: "ok", message: "Programa guardado" });
        await load(term.trim());
      } catch {
        setStatus({ kind: "error", message: "Error de conexión" });
      }
    },
    [draft, load, term]
  );

  const ready = customers.filter((c) => c.ready);

  return (
    <main className="min-h-screen p-6 md:p-10 relative bg-salon-bg">
      <MuralDecorations />

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="mb-8">
          <Link
            href="/admin"
            className="text-xs text-salon-gray font-bold uppercase tracking-wider hover:text-salon-brown mb-4 block"
          >
            ← Volver al panel
          </Link>
          <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
            Recompensas
          </h1>
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-8 bg-salon-terracotta"></div>
            <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              Programa de lealtad
            </p>
          </div>
        </header>

        {status && (
          <p
            role="status"
            aria-live="polite"
            className={`mb-5 rounded-2xl border-2 px-4 py-3 text-xs font-bold ${
              status.kind === "error"
                ? "border-salon-terracotta/40 bg-salon-terracotta/5 text-salon-terracotta"
                : "border-salon-olive/40 bg-salon-olive/5 text-salon-olive"
            }`}
          >
            {status.message}
          </p>
        )}

        {/* RESUMEN */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-3xl border-2 border-salon-olive/20 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">
              Con sellos
            </p>
            <p className="text-2xl font-black text-salon-olive tabular-nums">
              {totals?.withStamps ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-3xl border-2 border-salon-brown/20 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">
              Sellos vivos
            </p>
            <p className="text-2xl font-black text-salon-brown tabular-nums">
              {totals?.totalStamps ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-3xl border-2 border-salon-terracotta/30 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">
              Por canjear
            </p>
            <p className="text-2xl font-black text-salon-terracotta tabular-nums">
              {totals?.readyToRedeem ?? 0}
            </p>
          </div>
        </div>

        {/* LISTAS PARA CANJEAR */}
        {ready.length > 0 && (
          <section className="bg-salon-honey/10 border-2 border-salon-terracotta/40 rounded-3xl p-5 mb-6">
            <h2 className="text-xs font-black text-salon-terracotta uppercase tracking-widest mb-3">
              Listas para canjear ({ready.length})
            </h2>
            <ul className="space-y-2">
              {ready.map((customer) => (
                <li
                  key={customer.id}
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border-2 border-salon-terracotta/25"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-salon-brown text-sm truncate">
                      {customer.name}
                    </p>
                    <p className="text-[10px] text-salon-gray font-bold tabular-nums">
                      {customer.stamps} / {program?.stampsRequired ?? 5} sellos
                    </p>
                  </div>
                  <button
                    onClick={() => redeem(customer)}
                    disabled={busyId === customer.id || !program?.isActive}
                    className="shrink-0 px-4 py-2.5 bg-salon-brown text-salon-honey rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Canjear
                  </button>
                </li>
              ))}
            </ul>
            {!program?.isActive && (
              <p className="text-[10px] text-salon-gray font-bold mt-3">
                Activa el programa para poder canjear.
              </p>
            )}
          </section>
        )}

        {/* PROGRAMA */}
        <section className="bg-white rounded-2xl border-2 border-salon-olive/20 shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xs font-black text-salon-olive uppercase tracking-widest">
              Programa
            </h2>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                program?.isActive
                  ? "bg-salon-olive/10 text-salon-olive"
                  : "bg-salon-gray/10 text-salon-gray"
              }`}
            >
              {program?.isActive ? "Activo" : "Desactivado"}
            </span>
          </div>

          {!editing ? (
            <>
              <p className="text-sm font-black text-salon-brown leading-snug mb-1">
                {program?.stampsRequired ?? 5} sellos = {program?.rewardLabel ?? "—"}
              </p>
              <p className="text-[11px] text-salon-gray mb-4">
                {program?.maxRewardValue != null
                  ? `Tope de $${program.maxRewardValue} · `
                  : ""}
                Los sellos no vencen.
              </p>
              <button
                onClick={() => {
                  if (program) setDraft({ ...program });
                  setEditing(true);
                }}
                className="w-full py-3 border-2 border-salon-olive/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-salon-olive hover:bg-salon-olive/5 transition-all"
              >
                Editar programa
              </button>
            </>
          ) : (
            draft && (
              <form onSubmit={saveProgram} className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                    className="w-4 h-4 accent-salon-olive"
                  />
                  <span className="text-xs font-bold text-salon-brown">
                    Programa activo
                  </span>
                </label>

                <div>
                  <label
                    htmlFor="stamps-required"
                    className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
                  >
                    Sellos para la recompensa
                  </label>
                  <input
                    id="stamps-required"
                    type="number"
                    min={3}
                    max={12}
                    value={draft.stampsRequired}
                    onChange={(e) =>
                      setDraft({ ...draft, stampsRequired: Number(e.target.value) })
                    }
                    className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm font-bold text-salon-brown tabular-nums focus:outline-none focus:border-salon-olive/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reward-type"
                    className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
                  >
                    Tipo de recompensa
                  </label>
                  <select
                    id="reward-type"
                    value={draft.rewardType}
                    onChange={(e) => setDraft({ ...draft, rewardType: e.target.value })}
                    className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm font-bold text-salon-brown focus:outline-none focus:border-salon-olive/60"
                  >
                    {REWARD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {REWARD_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                {draft.rewardType !== "FREE_SERVICE" && (
                  <div>
                    <label
                      htmlFor="reward-value"
                      className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
                    >
                      {draft.rewardType === "PERCENT_DISCOUNT"
                        ? "Porcentaje"
                        : "Monto en pesos"}
                    </label>
                    <input
                      id="reward-value"
                      type="number"
                      min={0}
                      value={draft.rewardValue}
                      onChange={(e) =>
                        setDraft({ ...draft, rewardValue: Number(e.target.value) })
                      }
                      className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm font-bold text-salon-brown tabular-nums focus:outline-none focus:border-salon-olive/60"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reward-cap"
                    className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
                  >
                    Tope en pesos (vacío = sin tope)
                  </label>
                  <input
                    id="reward-cap"
                    type="number"
                    min={0}
                    value={draft.maxRewardValue ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        maxRewardValue: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm font-bold text-salon-brown tabular-nums focus:outline-none focus:border-salon-olive/60"
                  />
                  <p className="text-[10px] text-salon-gray mt-1.5 leading-relaxed">
                    Sin tope, un 50% sobre un maquillaje de novia cuesta mucho más de lo
                    que dejaron las cinco visitas que lo ganaron.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reward-label"
                    className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
                  >
                    Cómo lo lee la clienta
                  </label>
                  <input
                    id="reward-label"
                    type="text"
                    maxLength={80}
                    value={draft.rewardLabel}
                    onChange={(e) => setDraft({ ...draft, rewardLabel: e.target.value })}
                    className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm font-bold text-salon-brown focus:outline-none focus:border-salon-olive/60"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-salon-brown text-salon-honey rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.03] active:scale-[0.97]"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-salon-gray hover:text-salon-brown"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )
          )}
        </section>

        {/* PROGRESO */}
        <h2 className="text-xs font-black text-salon-olive uppercase tracking-widest mb-3">
          Progreso de clientas
        </h2>

        <div className="mb-4">
          <label htmlFor="rewards-search" className="sr-only">
            Buscar clienta por nombre o teléfono
          </label>
          <input
            id="rewards-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar clienta..."
            className="w-full bg-white border-2 border-salon-olive/20 rounded-2xl px-4 py-3.5 text-sm text-salon-brown font-bold placeholder:text-salon-gray/60 placeholder:font-normal focus:outline-none focus:border-salon-olive/60 transition-colors shadow-sm"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-2 border-salon-olive/10 h-[68px] animate-pulse"
              />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-salon-gray/20 rounded-3xl">
            <p className="text-salon-gray font-bold text-sm uppercase">
              {term.trim() ? "Sin resultados" : "Aún no hay clientas"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {customers.map((customer) => (
              <li
                key={customer.id}
                className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border-2 ${
                  customer.ready ? "border-salon-terracotta/30" : "border-salon-olive/15"
                }`}
              >
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="min-w-0 flex-1 group"
                >
                  <p className="font-black text-salon-brown text-sm truncate group-hover:text-salon-olive transition-colors">
                    {customer.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <StampDots
                      filled={Math.min(customer.stamps, program?.stampsRequired ?? 5)}
                      total={program?.stampsRequired ?? 5}
                    />
                    <span className="text-[10px] text-salon-gray font-bold tabular-nums">
                      {customer.stamps}
                    </span>
                    <span className="text-[10px] text-salon-gray/60">·</span>
                    <span className="text-[10px] text-salon-gray/70 tabular-nums">
                      {customer.maskedPhone}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => adjust(customer.id, "REMOVE")}
                    disabled={busyId === customer.id || customer.stamps === 0}
                    aria-label={`Quitar un sello a ${customer.name}`}
                    className="w-9 h-9 rounded-xl border-2 border-salon-gray/25 text-salon-gray font-black text-lg leading-none transition-colors hover:border-salon-terracotta hover:text-salon-terracotta disabled:opacity-30 disabled:hover:border-salon-gray/25 disabled:hover:text-salon-gray"
                  >
                    −
                  </button>
                  <button
                    onClick={() => adjust(customer.id, "ADD")}
                    disabled={busyId === customer.id}
                    aria-label={`Agregar un sello a ${customer.name}`}
                    className="w-9 h-9 rounded-xl border-2 border-salon-olive/40 text-salon-olive font-black text-lg leading-none transition-colors hover:bg-salon-olive hover:text-white disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10px] text-salon-gray mt-6 leading-relaxed">
          Los sellos por cita se otorgan al cobrar (fase 3). Aquí sólo se ajustan a mano:
          para premiar a una clienta de siempre o para corregir un error.
        </p>
      </div>
    </main>
  );
}
