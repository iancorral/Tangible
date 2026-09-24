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
import {
  formatChihuahuaTime,
  formatChihuahuaMonthShort,
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

  return (
    <main className="min-h-screen p-6 md:p-10 relative bg-salon-bg">
      <MuralDecorations />

      <div className="max-w-5xl mx-auto relative z-10">

        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
          <div>
            <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
              Panel de Control
            </h1>
            <div className="flex items-center gap-3 opacity-70">
              <div className="h-[2px] w-8 bg-salon-terracotta"></div>
              <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
                Administración Tangible
              </p>
            </div>
          </div>

          {/* Seven shortcuts: on a phone, two rows of four (Total Citas spans
              two cells) stay tappable, where a single row would not. */}
          <div className="grid grid-cols-4 gap-2 w-full md:flex md:w-auto md:gap-3">
            <a href="/admin/calendar" className="flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-lavender/30 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1">Agenda</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </a>
            <Link href="/admin/customers" className="flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-olive/30 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1">Clientas</span>
              <svg className="w-6 h-6 text-salon-olive" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              </svg>
            </Link>
            <a href="/admin/qr" className="flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-lavender/30 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1">QR</span>
              <svg className="w-6 h-6 text-salon-lavender" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="3" height="3"/>
                <rect x="18" y="14" width="3" height="3"/>
                <rect x="14" y="18" width="3" height="3"/>
                <rect x="18" y="18" width="3" height="3"/>
              </svg>
            </a>
            <Link href="/admin/rewards" className="flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-honey/50 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1">Premios</span>
              <svg className="w-6 h-6 text-salon-terracotta" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="6"/>
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
            </Link>
            <Link href="/admin/notes" className="flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-pink/40 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1">Notas</span>
              <svg className="w-6 h-6 text-salon-pink" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/>
                <path d="M15 3v6h6"/>
                <path d="M7 13h6"/>
                <path d="M7 17h10"/>
              </svg>
            </Link>
            <a href="/admin/schedule" className="flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-terracotta/30 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1">Horario</span>
              <svg className="w-6 h-6 text-salon-terracotta" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </a>
            <button onClick={() => window.location.reload()} className="group col-span-2 md:col-span-1 flex flex-col items-center justify-center min-w-0 bg-white px-2 py-3 md:px-6 border-2 border-salon-olive/30 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all">
              <span className="text-[10px] uppercase text-salon-gray font-bold tracking-wider mb-1 text-center leading-tight">Total Citas</span>
              <span className="text-2xl md:text-3xl font-black text-salon-olive group-hover:text-salon-terracotta transition-colors">
                {appointments.length}
              </span>
            </button>
          </div>
        </header>

        <MetricsDashboard />

        {/* RECORDATORIOS — citas de mañana */}
        {reminders.length > 0 && (
          <div className="bg-salon-yellow/10 border border-salon-yellow/40 rounded-3xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-xs font-black text-salon-brown uppercase tracking-widest">
                Recordatorios para mañana ({reminders.length})
              </h2>
              {unopenedCount > 0 && (
                <button
                  onClick={openNextReminder}
                  className="flex items-center gap-2 px-4 py-2 bg-salon-brown text-salon-yellow rounded-xl text-[11px] font-black uppercase tracking-wider transition-transform hover:scale-[1.03] active:scale-[0.97] shadow-sm shrink-0"
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
                  <div key={r.id} className={`flex items-center justify-between bg-white rounded-2xl px-4 py-3 border transition-all shadow-sm hover:shadow-md ${r.reminderSent ? 'opacity-50 border-gray-100' : opened ? 'border-salon-olive/40' : 'border-salon-yellow/30'}`}>
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

        {/* TABS */}
        <div className="flex gap-4 sm:gap-6 mb-3 border-b-2 border-salon-olive/10 pb-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={`shrink-0 whitespace-nowrap pb-2 text-xs font-black uppercase tracking-widest transition-all border-b-4 ${
                filter === tab.id
                  ? tab.activeClasses
                  : 'text-salon-gray border-transparent hover:text-salon-brown'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-60">
                {appointmentsByTab[tab.id].length}
              </span>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-salon-gray font-bold uppercase tracking-wider mb-3">
          Toca una cita para administrarla en la Agenda
        </p>

        {/* LISTA — solo informativa */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-20 text-salon-gray animate-pulse font-bold text-xs uppercase tracking-widest">
              Cargando agenda...
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-salon-gray/20 rounded-3xl">
              <p className="text-salon-gray font-bold text-sm uppercase">{activeTab.empty}</p>
            </div>
          ) : (
            visibleAppointments.map((app) => {
              const price = getAppointmentAmount(app);
              const isFree = isFreeAmount(price);
              const apptDate = new Date(app.date);
              const dateKey = chihuahuaDateKey(apptDate);
              return (
                <a
                  key={app.id}
                  href={`/admin/calendar?date=${dateKey}`}
                  className={`flex items-center gap-4 bg-white p-4 rounded-2xl border-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${
                    app.status === 'CANCELLED' ? 'border-gray-100 opacity-60' : 'border-salon-olive/20'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold border-2 border-salon-olive/20 bg-salon-bg text-salon-brown shrink-0">
                    <span className="text-[9px] uppercase tracking-wider">{formatChihuahuaMonthShort(apptDate)}</span>
                    <span className="text-xl font-black">{getChihuahuaParts(apptDate).day}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-salon-brown uppercase tracking-wide truncate">{app.clientName}</h3>
                      {isFree ? (
                        <FreeTag className="shrink-0" />
                      ) : (
                        <SensitiveAmount value={price} className="text-sm font-black text-salon-brown shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-salon-terracotta font-bold">{formatChihuahuaTime(apptDate)}</span>
                      <span className="text-[10px] text-salon-gray">·</span>
                      <span className="text-[10px] text-salon-gray font-bold truncate">
                        {app.services.map(s => s.name).join(', ')}
                      </span>
                    </div>
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

                  <span className="text-salon-gray text-lg shrink-0">›</span>
                </a>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}