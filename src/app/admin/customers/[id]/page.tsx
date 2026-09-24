"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MuralDecorations from "@/components/layout/MuralDecorations";
import PaymentBadge from "@/components/admin/PaymentBadge";
import FreeTag from "@/components/admin/FreeTag";
import { SensitiveAmount } from "@/components/privacy";
import { getAppointmentAmount, isFreeAmount } from "@/lib/pricing";
import { formatPhone } from "@/lib/phone";
import {
  chihuahuaDateKey,
  formatChihuahuaMonthShort,
  formatChihuahuaTime,
  getChihuahuaParts,
} from "@/lib/timezone";

type Service = { id: string; name: string; price: number; duration: number };

type Appointment = {
  id: string;
  date: string;
  clientName: string;
  status: string;
  services: Service[];
  paymentStatus: string;
  paymentMethod?: string | null;
  finalPrice?: number | null;
  createdByAdmin?: boolean;
};

type Customer = { id: string; name: string; phone: string; notes: string | null };

type Stats = {
  visits: number;
  cancelled: number;
  totalSpent: number;
  lastVisit: string | null;
};

/** The customer that already owns the phone number the owner just typed in. */
type Conflict = { id: string; name: string; visits: number };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/customers/${id}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    setCustomer(data.customer);
    setAppointments(data.appointments ?? []);
    setStats(data.stats);
    return data.customer as Customer;
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/customers/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCustomer(data.customer);
        setAppointments(data.appointments ?? []);
        setStats(data.stats);
        setName(data.customer.name);
        setPhone(formatPhone(data.customer.phone));
        setNotes(data.customer.notes ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSaving(true);
      setStatus(null);

      try {
        const res = await fetch(`/api/admin/customers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, notes }),
        });
        const data = await res.json();

        if (!res.ok) {
          // A phone that belongs to someone else is not a validation error to
          // retype past: it means there may be two records for one person, and
          // the owner decides whether to join them.
          if (res.status === 409 && data.conflict) setConflict(data.conflict);
          setStatus({ kind: "error", message: data.error ?? "No se pudo guardar" });
          return;
        }

        setCustomer(data);
        setName(data.name);
        setPhone(formatPhone(data.phone));
        setNotes(data.notes ?? "");
        setConflict(null);
        setStatus({ kind: "ok", message: "Cambios guardados" });
      } catch {
        setStatus({ kind: "error", message: "Error de conexión" });
      } finally {
        setSaving(false);
      }
    },
    [id, name, phone, notes]
  );

  const merge = useCallback(async () => {
    if (!conflict) return;
    setMerging(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/admin/customers/${id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: conflict.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "No se pudo unir" });
        return;
      }

      // The merge moved the history and took the phone; the name and notes the
      // owner had typed are still unsaved, so persist them now that they can be.
      const refreshed = await load();
      setName(refreshed.name);
      setPhone(formatPhone(refreshed.phone));
      setNotes(refreshed.notes ?? "");
      setConflict(null);
      setStatus({
        kind: "ok",
        message: `Fichas unidas · ${data.appointmentsMoved} cita${
          data.appointmentsMoved === 1 ? "" : "s"
        } movida${data.appointmentsMoved === 1 ? "" : "s"}`,
      });
    } catch {
      setStatus({ kind: "error", message: "Error de conexión" });
    } finally {
      setMerging(false);
    }
  }, [conflict, id, load]);

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10 bg-salon-bg">
        <p className="text-center py-20 text-salon-gray animate-pulse font-bold text-xs uppercase tracking-widest">
          Cargando clienta...
        </p>
      </main>
    );
  }

  if (notFound || !customer || !stats) {
    return (
      <main className="min-h-screen p-6 md:p-10 bg-salon-bg">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-salon-gray font-bold text-sm uppercase mb-4">
            Clienta no encontrada
          </p>
          <Link
            href="/admin/customers"
            className="text-xs text-salon-terracotta font-bold uppercase tracking-wider underline"
          >
            Volver a Clientas
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10 relative bg-salon-bg">
      <MuralDecorations />

      <div className="max-w-2xl mx-auto relative z-10">
        <header className="mb-8">
          <Link
            href="/admin/customers"
            className="text-xs text-salon-gray font-bold uppercase tracking-wider hover:text-salon-brown mb-4 block"
          >
            ← Volver a Clientas
          </Link>
          <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
            {customer.name}
          </h1>
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-8 bg-salon-terracotta"></div>
            <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              Ficha de clienta
            </p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-3xl border-2 border-salon-olive/20 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">
              Citas
            </p>
            <p className="text-2xl font-black text-salon-olive tabular-nums">{stats.visits}</p>
            {stats.cancelled > 0 && (
              <p className="text-[10px] text-salon-gray mt-1 font-medium">
                {stats.cancelled} cancelada{stats.cancelled !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="bg-white rounded-3xl border-2 border-salon-brown/20 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">
              Total
            </p>
            <SensitiveAmount
              value={stats.totalSpent}
              className="block text-2xl font-black text-salon-brown"
            />
          </div>

          <div className="bg-white rounded-3xl border-2 border-salon-lavender/30 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-salon-gray font-bold mb-1">
              Última
            </p>
            {stats.lastVisit ? (
              <p className="text-sm font-black text-salon-lavender leading-tight">
                {getChihuahuaParts(new Date(stats.lastVisit)).day}{" "}
                {formatChihuahuaMonthShort(new Date(stats.lastVisit))}
              </p>
            ) : (
              <p className="text-sm text-salon-gray font-bold">—</p>
            )}
          </div>
        </div>

        {/* DATOS EDITABLES */}
        <form
          onSubmit={save}
          className="bg-white rounded-2xl border-2 border-salon-olive/20 shadow-sm p-5 mb-8"
        >
          <h2 className="text-xs font-black text-salon-olive uppercase tracking-widest mb-4">
            Información
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="customer-name"
                className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
              >
                Nombre
              </label>
              <input
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm text-salon-brown font-bold focus:outline-none focus:border-salon-olive/60 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="customer-phone"
                className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
              >
                Teléfono
              </label>
              <input
                id="customer-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setConflict(null);
                }}
                required
                maxLength={20}
                aria-invalid={conflict !== null}
                aria-describedby={conflict ? "phone-conflict" : undefined}
                className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm text-salon-brown font-bold tabular-nums focus:outline-none focus:border-salon-olive/60 transition-colors"
              />
              <p className="text-[10px] text-salon-gray mt-1.5 leading-relaxed">
                Es la identidad de la clienta: las citas nuevas se enlazan con este número.
              </p>
            </div>

            <div>
              <label
                htmlFor="customer-notes"
                className="block text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5"
              >
                Notas
              </label>
              <textarea
                id="customer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Alergias, preferencias, lo que quieras recordar..."
                className="w-full bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-sm text-salon-brown placeholder:text-salon-gray/60 focus:outline-none focus:border-salon-olive/60 transition-colors resize-none"
              />
            </div>
          </div>

          {conflict && (
            <div
              id="phone-conflict"
              role="alert"
              className="mt-5 bg-salon-terracotta/5 border-2 border-salon-terracotta/40 rounded-2xl p-4"
            >
              <p className="text-[10px] font-black text-salon-terracotta uppercase tracking-widest mb-2">
                Teléfono duplicado · no se guardó nada
              </p>
              <p className="text-xs text-salon-brown leading-relaxed mb-3">
                Ese número ya es de <strong>{conflict.name}</strong>, con {conflict.visits}{" "}
                {conflict.visits === 1 ? "cita" : "citas"}.
              </p>
              <p className="text-[11px] text-salon-gray leading-relaxed mb-4">
                Si es la misma persona, une las dos fichas: sus citas pasan a esta ficha y cada
                una conserva el nombre con el que se agendó. La otra ficha se elimina. Si son dos
                personas distintas, corrige el teléfono.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={merge}
                  disabled={merging}
                  className="px-4 py-2.5 bg-salon-terracotta text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {merging ? "Uniendo..." : "Unir las dos fichas"}
                </button>
                <Link
                  href={`/admin/customers/${conflict.id}`}
                  className="px-4 py-2.5 border-2 border-salon-gray/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-salon-gray hover:text-salon-brown transition-colors"
                >
                  Ver la otra ficha
                </Link>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <button
              type="submit"
              disabled={saving || merging}
              className="px-6 py-3 bg-salon-brown text-salon-honey rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>

            <p
              role="status"
              aria-live="polite"
              className={`text-[10px] font-bold uppercase tracking-wider ${
                status?.kind === "error" ? "text-salon-terracotta" : "text-salon-olive"
              }`}
            >
              {status?.message ?? ""}
            </p>
          </div>
        </form>

        {/* HISTORIAL */}
        <h2 className="text-xs font-black text-salon-olive uppercase tracking-widest mb-3">
          Historial de citas
        </h2>
        <p className="text-[10px] text-salon-gray font-bold uppercase tracking-wider mb-3">
          Cada cita guarda el nombre con el que se agendó ese día
        </p>

        {appointments.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-salon-gray/20 rounded-3xl">
            <p className="text-salon-gray font-bold text-sm uppercase">Sin citas registradas</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {appointments.map((appointment) => {
              const price = getAppointmentAmount(appointment);
              const isFree = isFreeAmount(price);
              const date = new Date(appointment.date);
              const isCancelled = appointment.status === "CANCELLED";

              return (
                <li key={appointment.id}>
                  <Link
                    href={`/admin/calendar?date=${chihuahuaDateKey(date)}`}
                    className={`flex items-center gap-4 bg-white p-4 rounded-2xl border-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${
                      isCancelled ? "border-gray-100 opacity-60" : "border-salon-olive/20"
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold border-2 border-salon-olive/20 bg-salon-bg text-salon-brown shrink-0">
                      <span className="text-[9px] uppercase tracking-wider">
                        {formatChihuahuaMonthShort(date)}
                      </span>
                      <span className="text-xl font-black">{getChihuahuaParts(date).day}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-salon-terracotta font-bold">
                          {formatChihuahuaTime(date)}
                        </span>
                        {isFree ? (
                          <FreeTag className="shrink-0" />
                        ) : (
                          <SensitiveAmount
                            value={price}
                            className="text-sm font-black text-salon-brown shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-salon-gray font-bold truncate mt-0.5">
                        {appointment.services.map((s) => s.name).join(", ")}
                      </p>
                      {appointment.clientName.trim() !== customer.name && (
                        <p className="text-[10px] text-salon-gray/70 truncate mt-0.5 italic">
                          Agendada como {appointment.clientName.trim()}
                        </p>
                      )}
                      <div className="mt-1.5">
                        <PaymentBadge
                          paymentStatus={
                            (appointment.paymentStatus as "PENDING" | "PARTIAL" | "PAID") ??
                            "PENDING"
                          }
                          appStatus={appointment.status as "CONFIRMED" | "CANCELLED"}
                          createdByAdmin={appointment.createdByAdmin}
                          paymentMethod={appointment.paymentMethod}
                          isFree={isFree}
                        />
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
