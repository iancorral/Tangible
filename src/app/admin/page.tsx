"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import MetricsDashboard from '@/components/admin/MetricsDashboard';
import MuralDecorations from '@/components/layout/MuralDecorations';
import PaymentBadge from '@/components/admin/PaymentBadge';
import FreeTag from '@/components/admin/FreeTag';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { SensitiveAmount } from '@/components/privacy';
import { getAppointmentAmount, isFreeAmount } from '@/lib/pricing';
import { buildReminderUrl } from '@/lib/whatsapp';
import { OWNER_NAME } from '@/lib/config/business';
import {
  formatChihuahuaTime,
  formatChihuahuaDate,
  getChihuahuaParts,
  chihuahuaDateKey,
} from '@/lib/timezone';

type Service = { id: string; name: string; price: number; duration: number };
type Appointment = {
  id: string;
  date: string | Date;
  endDate: string | Date;
  clientName: string;
  clientPhone: string | null;
  status: string;
  services: Service[];
  paymentStatus: string;
  paymentMethod?: string | null;
  finalPrice?: number | null;
  createdByAdmin?: boolean;
};

type Reminder = {
  id: string; // appointmentId
  clientName: string;
  clientPhone: string;
  date: string; // instante UTC de la cita
  services: { name: string }[];
  reminderSent: boolean;
};

type AppointmentTab = 'UPCOMING' | 'HISTORY' | 'CANCELLED';

const TABS: { id: AppointmentTab; label: string; activeClasses: string; empty: string }[] = [
  {
    id: 'UPCOMING',
    label: 'Próximas',
    activeClasses: 'text-salon-olive border-salon-olive',
    empty: 'No hay citas próximas',
  },
  {
    id: 'HISTORY',
    label: 'Historial',
    activeClasses: 'text-salon-brown border-salon-brown',
    empty: 'Aún no hay citas en el historial',
  },
  {
    id: 'CANCELLED',
    label: 'Canceladas',
    activeClasses: 'text-salon-terracotta border-salon-terracotta',
    empty: 'No hay citas canceladas',
  },
];

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<AppointmentTab>('UPCOMING');
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/appointments')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setAppointments(data);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setLoading(false);
      });

    fetch('/api/admin/reminders')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setReminders(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());

  const setReminderSent = useCallback(async (appointmentId: string, sent: boolean) => {
    setReminders(prev =>
      prev.map(r => (r.id === appointmentId ? { ...r, reminderSent: sent } : r))
    );
    await fetch('/api/admin/reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, sent }),
    }).catch(() => {});
  }, []);
  const openReminder = useCallback((r: Reminder) => {
    const url = buildReminderUrl(r.clientPhone, {
      clientName: r.clientName,
      date: r.date,
      serviceNames: r.services.map(s => s.name),
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpenedIds(prev => new Set(prev).add(r.id));
  }, []);

  const undoSent = useCallback((appointmentId: string) => {
    setOpenedIds(prev => {
      const next = new Set(prev);
      next.delete(appointmentId);
      return next;
    });
    setReminderSent(appointmentId, false);
  }, [setReminderSent]);

  const openNextReminder = useCallback(() => {
    const next = reminders.find(r => !r.reminderSent && !openedIds.has(r.id));
    if (next) openReminder(next);
  }, [reminders, openedIds, openReminder]);

  const unopenedCount = reminders.filter(r => !r.reminderSent && !openedIds.has(r.id)).length;

  // A cancelled appointment always belongs to its own tab, whether it already
  // happened or not; the rest split on whether they have finished.
  const appointmentsByTab = useMemo(() => {
    const now = new Date().getTime();
    const groups: Record<AppointmentTab, Appointment[]> = {
      UPCOMING: [],
      HISTORY: [],
      CANCELLED: [],
    };

    appointments.forEach(app => {
      if (app.status === 'CANCELLED') groups.CANCELLED.push(app);
      else if (new Date(app.endDate).getTime() < now) groups.HISTORY.push(app);
      else groups.UPCOMING.push(app);
    });

    const soonestFirst = (a: Appointment, b: Appointment) =>
      new Date(a.date).getTime() - new Date(b.date).getTime();
    const mostRecentFirst = (a: Appointment, b: Appointment) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();

    groups.UPCOMING.sort(soonestFirst);
    groups.HISTORY.sort(mostRecentFirst);
    groups.CANCELLED.sort(mostRecentFirst);

    return groups;
  }, [appointments]);

  const activeTab = TABS.find(tab => tab.id === filter) ?? TABS[0];
  const visibleAppointments = appointmentsByTab[filter];

  const now = new Date();
  const todayKey = chihuahuaDateKey(now);
  const tomorrowKey = chihuahuaDateKey(new Date(now.getTime() + 86_400_000));
  const hour = getChihuahuaParts(now).hour;
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  const todayAppointments = appointmentsByTab.UPCOMING.filter(
    (a) => chihuahuaDateKey(new Date(a.date)) === todayKey
  );
  const nextToday = todayAppointments[0];

  // Agrupa la lista por día de Chihuahua conservando el orden de la pestaña.
  const groupedAppointments: { key: string; items: Appointment[] }[] = [];
  for (const app of visibleAppointments) {
    const key = chihuahuaDateKey(new Date(app.date));
    const last = groupedAppointments[groupedAppointments.length - 1];
    if (last?.key === key) last.items.push(app);
    else groupedAppointments.push({ key, items: [app] });
  }

  const dayLabel = (key: string, sample: Date) =>
    key === todayKey ? 'Hoy' : key === tomorrowKey ? 'Mañana' : formatChihuahuaDate(sample);

  return (
    <main className="min-h-[100dvh] relative bg-salon-bg">
      <MuralDecorations />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-8 sm:px-6 lg:px-10 lg:pt-10">
        {/* ENCABEZADO */}
        <header className="mb-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p suppressHydrationWarning className="text-[11px] font-bold uppercase tracking-[0.2em] text-salon-terracotta">
              {formatChihuahuaDate(now)}
            </p>
            {/* En celular el nombre baja a su propia línea para no apretarse
                junto al botón; desde sm cabe en una sola. */}
            <h1 suppressHydrationWarning className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.12em] leading-tight mt-1">
              <span className="block sm:inline">{greeting},</span>{' '}
              <span className="block sm:inline text-salon-terracotta">{OWNER_NAME}</span>
            </h1>
          </div>
          {/* En celular es un botón redondo para dejarle el ancho al saludo. */}
          <Link
            href="/admin/calendar?new=1"
            aria-label="Nueva cita"
            className="shrink-0 inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-salon-brown text-white shadow-md transition-colors hover:bg-salon-brown/90 active:scale-[0.96] sm:h-auto sm:w-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-[11px] sm:font-black sm:uppercase sm:tracking-widest"
          >
            <svg className="h-5 w-5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Nueva cita</span>
          </Link>
        </header>

        {/* HOY */}
        {!loading && (
          <Link
            href={`/admin/calendar?date=${todayKey}`}
            className="mb-6 flex items-center gap-4 rounded-3xl border-2 border-salon-olive/15 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-salon-olive text-white">
              <span className="text-xl font-black leading-none tabular-nums">{todayAppointments.length}</span>
              <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">hoy</span>
            </div>
            <div className="min-w-0 flex-1">
              {nextToday ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-salon-gray">Siguiente</p>
                  <p className="truncate text-sm font-black text-salon-brown">
                    <span className="text-salon-terracotta tabular-nums">{formatChihuahuaTime(new Date(nextToday.date))}</span>
                    {' · '}{nextToday.clientName}
                  </p>
                  <p className="truncate text-[11px] text-salon-gray">{nextToday.services.map((s) => s.name).join(', ')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-salon-brown">No te quedan citas hoy</p>
                  <p className="text-[11px] text-salon-gray">Toca para ver la agenda del día</p>
                </>
              )}
            </div>
            <span className="text-salon-gray text-lg" aria-hidden="true">›</span>
          </Link>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {/* COLUMNA LATERAL: métricas y recordatorios (arriba en celular) */}
          <aside className="space-y-6 lg:order-2 lg:sticky lg:top-8">
            <MetricsDashboard layout="rail" />
            {/* RECORDATORIOS — citas de mañana */}
            {reminders.length > 0 && (
              <div className="bg-salon-blush/20 border border-salon-pink/30 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h2 className="text-xs font-black text-salon-brown uppercase tracking-widest">
                    Recordatorios para mañana ({reminders.length})
                  </h2>
                  {unopenedCount > 0 && (
                    <button
                      onClick={openNextReminder}
                      className="flex items-center gap-2 px-4 py-2 bg-salon-brown text-salon-blush rounded-xl text-[11px] font-black uppercase tracking-wider transition-transform hover:scale-[1.03] active:scale-[0.97] shadow-sm shrink-0"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      Abrir siguiente ({unopenedCount})
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-salon-gray font-bold mb-3">
                  Se abre WhatsApp con el mensaje listo. Al volver, confirma el envío con &quot;Ya lo envié&quot;
                  (la app no puede saber por sí sola si el mensaje se mandó).
                </p>

                <div className="space-y-2">
                  {reminders.map((r) => {
                    const opened = openedIds.has(r.id);
                    return (
                      <div key={r.id} className={`flex items-center justify-between bg-white rounded-2xl px-4 py-3 border transition-all shadow-sm hover:shadow-md ${r.reminderSent ? 'opacity-50 border-gray-100' : opened ? 'border-salon-olive/40' : 'border-salon-pink/25'}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-salon-brown text-sm truncate">{r.clientName}</span>
                            <span className="text-[10px] font-black text-salon-terracotta bg-salon-terracotta/10 px-2 py-0.5 rounded-full shrink-0">
                              {formatChihuahuaTime(new Date(r.date))}
                            </span>
                          </div>
                          <span className="text-salon-gray text-[10px] font-bold truncate block">
                            {r.services.map(s => s.name).join(', ')}
                          </span>
                        </div>

                        {r.reminderSent ? (
                          // Estado final: enviado. Permite deshacer si se marcó por error.
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs text-gray-400 font-bold uppercase">Enviado</span>
                            <button
                              onClick={() => undoSent(r.id)}
                              className="text-[10px] text-salon-gray/70 font-bold uppercase underline hover:text-salon-terracotta"
                            >
                              Deshacer
                            </button>
                          </div>
                        ) : opened ? (
                          // Se abrió WhatsApp: la admin confirma manualmente el envío real.
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <button
                              onClick={() => openReminder(r)}
                              className="text-[10px] text-salon-gray font-bold uppercase underline hover:text-salon-brown"
                            >
                              Reabrir
                            </button>
                            <button
                              onClick={() => setReminderSent(r.id, true)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-salon-olive text-white rounded-xl text-xs font-bold uppercase transition-transform hover:scale-[1.05] active:scale-[0.95] shadow-sm"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                              Ya lo envié
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => openReminder(r)} className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold uppercase transition-transform hover:scale-[1.05] active:scale-[0.95] shadow-sm shrink-0 ml-3">
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            Enviar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </aside>

          {/* CITAS */}
          <section className="min-w-0 lg:order-1">
            <div className="mb-4 flex gap-1 rounded-2xl border-2 border-salon-gray/10 bg-white/70 p-1" role="tablist">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  onClick={() => setFilter(tab.id)}
                  aria-selected={filter === tab.id}
                  className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                    filter === tab.id ? 'bg-salon-brown text-white shadow-sm' : 'text-salon-gray hover:text-salon-brown'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 tabular-nums opacity-60">{appointmentsByTab[tab.id].length}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[76px] rounded-2xl border-2 border-salon-olive/10 bg-white animate-pulse" />
                ))}
              </div>
            ) : visibleAppointments.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-salon-gray/20 rounded-3xl">
                <p className="text-salon-gray font-bold text-sm uppercase">{activeTab.empty}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedAppointments.map((group) => (
                  <section key={group.key}>
                    <div className="mb-2 flex items-baseline justify-between px-1">
                      <h2 className="text-[11px] font-black uppercase tracking-widest text-salon-brown">
                        {dayLabel(group.key, new Date(group.items[0].date))}
                      </h2>
                      <span className="text-[10px] font-bold text-salon-gray">
                        {group.items.length} {group.items.length === 1 ? 'cita' : 'citas'}
                      </span>
                    </div>
                    <ul className="overflow-hidden rounded-2xl border-2 border-salon-olive/15 bg-white shadow-sm divide-y divide-salon-olive/10">
                      {group.items.map((app) => {
                        const price = getAppointmentAmount(app);
                        const isFree = isFreeAmount(price);
                        const start = new Date(app.date);
                        const minutes = Math.round((new Date(app.endDate).getTime() - start.getTime()) / 60000);
                        return (
                          <li key={app.id}>
                            <Link
                              href={`/admin/calendar?date=${group.key}`}
                              className={`flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-salon-bg/60 active:bg-salon-bg ${
                                app.status === 'CANCELLED' ? 'opacity-60' : ''
                              }`}
                            >
                              <div className="w-14 shrink-0 text-center">
                                <p className="text-base font-black text-salon-brown tabular-nums leading-tight">
                                  {formatChihuahuaTime(start)}
                                </p>
                                <p className="text-[10px] font-bold text-salon-gray">{minutes} min</p>
                              </div>
                              <div className="min-w-0 flex-1 border-l-2 border-salon-terracotta/20 pl-4">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="truncate font-black text-salon-brown">{app.clientName}</h3>
                                  {isFree ? (
                                    <FreeTag className="shrink-0" />
                                  ) : (
                                    <SensitiveAmount value={price} className="shrink-0 text-sm font-black text-salon-brown" />
                                  )}
                                </div>
                                <p className="truncate text-[11px] text-salon-gray">
                                  {app.services.map((s) => s.name).join(', ')}
                                </p>
                                <div className="mt-1.5">
                                  <PaymentBadge
                                    paymentStatus={(app.paymentStatus as 'PENDING' | 'PARTIAL' | 'PAID') ?? 'PENDING'}
                                    appStatus={(app.status as 'CONFIRMED' | 'CANCELLED')}
                                    createdByAdmin={app.createdByAdmin}
                                    paymentMethod={app.paymentMethod}
                                    isFree={isFree}
                                  />
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}