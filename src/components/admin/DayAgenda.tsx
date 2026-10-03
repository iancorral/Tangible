"use client";

import { useMemo, useState } from "react";
import {
  utcDateToChihuahuaMinutes,
  minutesToTimeLabel,
  CHIHUAHUA_UTC_OFFSET,
} from "@/lib/timezone";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { METHOD_LABELS } from "@/components/admin/PaymentBadge";
import FreeTag from "@/components/admin/FreeTag";
import { SensitiveAmount } from "@/components/privacy";
import { getAppointmentAmount, isFreeAmount } from "@/lib/pricing";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";

type Service = { id: string; name: string; price: number; duration: number; category: string };

export type AgendaAppointment = {
  id: string;
  date: string | Date;
  endDate: string | Date;
  clientName: string;
  clientPhone: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  finalPrice?: number | null;
  depositPaid?: boolean;
  depositAmount?: number | null;
  adminNotes?: string | null;
  services: Service[];
};

interface Props {
  appointments: AgendaAppointment[];
  schedule: { startTime: string; endTime: string; isDayOff: boolean } | null;
  loading: boolean;
  isPast: boolean;
  isCurrentDay: boolean;          // ← nuevo: hoy vs. otro día
  moveModeId: string | null;
  onSlotClick: (time: string) => void;
  onAppointmentClick: (app: AgendaAppointment) => void;
  onPaymentClick: (app: AgendaAppointment) => void;
  onStartMove: (app: AgendaAppointment) => void;
  onDropMove: (time: string) => void;
  onCancelMove: () => void;
}

const SLOT_MINUTES = 30;
const ADMIN_START = 6 * 60;   // 06:00
const ADMIN_END = 22 * 60;    // 22:00

const PAYMENT_META: Record<string, { label: string; classes: string }> = {
  PENDING: { label: "Pendiente", classes: "bg-salon-mustard-50 border-salon-mustard-200 text-salon-mustard-700" },
  PARTIAL: { label: "Anticipo",  classes: "bg-blue-50 border-blue-200 text-blue-800" },
  PAID:    { label: "Pagado",    classes: "bg-green-50 border-green-200 text-green-800" },
};

// Courtesy appointments have no payment state to report, so they get their own
// look instead of borrowing one of the payment colours.
const FREE_META = {
  label: "Sin cobro",
  classes: "bg-salon-lavender/10 border-salon-lavender/30 text-salon-brown",
};

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function DayAgenda({
  appointments, schedule, loading, isPast, isCurrentDay, moveModeId,
  onSlotClick, onAppointmentClick, onPaymentClick, onStartMove, onDropMove, onCancelMove,
}: Props) {

  // Minuto actual (hora de Chihuahua): distingue los slots de hoy que ya pasaron.
  const nowMinutes = useMemo(() => {
    const now = new Date();
    const chihuahuaHour = (now.getUTCHours() - CHIHUAHUA_UTC_OFFSET + 24) % 24;
    return chihuahuaHour * 60 + now.getUTCMinutes();
  }, []);

  // Por defecto, hoy la agenda arranca en el próximo slot (omite horas ya
  // pasadas para reducir ruido). El botón "horas anteriores" las revela para
  // registrar una cita que se olvidó agendar más temprano el mismo día.
  const [showEarlierToday, setShowEarlierToday] = useState(false);

  const nextSlotToday = useMemo(
    () => Math.max(ADMIN_START, Math.ceil(nowMinutes / SLOT_MINUTES) * SLOT_MINUTES),
    [nowMinutes]
  );

  const gridStart = isCurrentDay && !showEarlierToday ? nextSlotToday : ADMIN_START;
  const hasEarlierToday = isCurrentDay && nextSlotToday > ADMIN_START;

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-salon-gray animate-pulse uppercase tracking-widest">
        Cargando agenda...
      </div>
    );
  }

  const confirmedApps = appointments.filter((a) => a.status !== "CANCELLED");
  const cancelledApps = appointments.filter((a) => a.status === "CANCELLED");
  const publicStart = schedule ? timeToMinutes(schedule.startTime) : null;
  const publicEnd   = schedule ? timeToMinutes(schedule.endTime)   : null;
  const isDayOff    = schedule?.isDayOff ?? false;

  const appsByStart = new Map<number, AgendaAppointment>();
  confirmedApps.forEach((app) => {
    appsByStart.set(utcDateToChihuahuaMinutes(new Date(app.date)), app);
  });

  const rendered = new Set<string>();
  const rows: React.ReactNode[] = [];
  let t = gridStart;

  while (t < ADMIN_END) {
    const app = appsByStart.get(t);
    const inPublicHours =
      publicStart !== null && publicEnd !== null && t >= publicStart && t < publicEnd;

    if (app) {
      const appStart = utcDateToChihuahuaMinutes(new Date(app.date));
      const appEnd   = utcDateToChihuahuaMinutes(new Date(app.endDate));
      const durationMin = appEnd > appStart ? appEnd - appStart : appEnd + 1440 - appStart;
      const slotsSpan = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));

      rendered.add(app.id);
      rows.push(
        <AppointmentCard
          key={`app-${app.id}`}
          app={app}
          past={isPast}
          isMoving={moveModeId === app.id}
          dimmed={moveModeId !== null && moveModeId !== app.id}
          onClick={() => onAppointmentClick(app)}
          onPaymentClick={() => onPaymentClick(app)}
          onMoveClick={() => onStartMove(app)}
          onCancelMove={onCancelMove}
        />
      );

      t += slotsSpan * SLOT_MINUTES;
      continue;
    }

    const label = minutesToTimeLabel(t);
    const isDropTarget = moveModeId !== null;
    // Un slot es "pasado" si el día completo ya pasó, o si es una hora de hoy
    // anterior al momento actual (cita olvidada que se registra a posteriori).
    const slotPast = isPast || (isCurrentDay && t < nowMinutes);

    rows.push(
      <button
        key={`slot-${t}`}
        onClick={() => {
          if (isDropTarget) onDropMove(label);
          else onSlotClick(label);
        }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all text-left group ${
          isDropTarget
            ? "border-2 border-dashed border-blue-400 bg-blue-50 hover:bg-blue-100"
            : slotPast
            ? "border-dashed border-gray-200 hover:border-salon-gray/40 hover:bg-gray-50"
            : "border-dashed border-salon-gray/15 hover:border-salon-olive hover:bg-salon-olive/5"
        }`}
      >
        <span className={`text-[11px] font-black uppercase tracking-wider w-12 shrink-0 ${
          isDropTarget
            ? "text-blue-600"
            : slotPast
            ? "text-gray-300"
            : !inPublicHours
            ? "text-salon-gray/40"
            : "text-salon-gray"
        }`}>
          {label}
        </span>
        <span className={`text-[10px] font-bold transition-opacity opacity-0 group-hover:opacity-100 ${
          isDropTarget
            ? "text-blue-600"
            : slotPast
            ? "text-salon-gray/60"
            : "text-salon-olive"
        }`}>
          {isDropTarget
            ? "Soltar aquí"
            : slotPast
            ? "+ Registrar cita pasada"
            : !inPublicHours
            ? "+ Agregar (fuera de horario)"
            : "+ Agregar cita"}
        </span>
      </button>
    );

    t += SLOT_MINUTES;
  }

  // Citas fuera de la cuadrícula (horario anterior al efectivo u otras)
  const extras = confirmedApps.filter((a) => !rendered.has(a.id));

  return (
    <div className="p-2 space-y-1.5 max-h-[560px] overflow-y-auto">
      {isDayOff && (
        <div className="bg-salon-blush/20 border border-salon-pink/30 rounded-xl px-3 py-2 text-[10px] text-salon-brown font-bold text-center mb-1">
          Día cerrado al público — puedes agendar manualmente
        </div>
      )}

      {moveModeId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-blue-700 font-bold">
              Toca un slot libre para mover la cita.
            </span>
            <button
              onClick={onCancelMove}
              className="text-[10px] text-blue-700 font-black underline ml-2 shrink-0"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[9px] text-blue-500 font-bold mt-0.5">
            Tip: navega a otro día en el calendario para mover entre días.
          </p>
        </div>
      )}

      {/* Hoy: revela las horas ya pasadas para registrar una cita olvidada. */}
      {hasEarlierToday && !moveModeId && (
        <button
          onClick={() => setShowEarlierToday((v) => !v)}
          className="w-full text-[10px] font-black uppercase tracking-widest text-salon-olive border border-dashed border-salon-olive/30 rounded-xl px-3 py-2 hover:bg-salon-olive/5 transition-all"
        >
          {showEarlierToday
            ? "Ocultar horas anteriores"
            : "＋ Registrar cita anterior de hoy"}
        </button>
      )}

      {rows}

      {extras.length > 0 && (
        <>
          <p className="text-[9px] font-black text-salon-gray uppercase tracking-widest px-3 pt-2">
            Otras citas del día
          </p>
          {extras.map((app) => (
            <AppointmentCard
              key={`extra-${app.id}`}
              app={app}
              past={isPast}
              isMoving={moveModeId === app.id}
              dimmed={moveModeId !== null && moveModeId !== app.id}
              onClick={() => onAppointmentClick(app)}
              onPaymentClick={() => onPaymentClick(app)}
              onMoveClick={() => onStartMove(app)}
              onCancelMove={onCancelMove}
            />
          ))}
        </>
      )}

      {cancelledApps.length > 0 && (
        <>
          <p className="text-[9px] font-black text-salon-gray uppercase tracking-widest px-3 pt-3">
            Canceladas ({cancelledApps.length})
          </p>
          {cancelledApps.map((app) => (
            <CancelledCard
              key={`cancel-${app.id}`}
              app={app}
              onClick={() => onAppointmentClick(app)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Cita cancelada: registro atenuado con indicador claro. Al tocarla se abre el
// modal de gestión, donde se puede restaurar o eliminar permanentemente.
function CancelledCard({
  app,
  onClick,
}: {
  app: AgendaAppointment;
  onClick: () => void;
}) {
  const startLabel = minutesToTimeLabel(utcDateToChihuahuaMinutes(new Date(app.date)));

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/70 p-3 text-left opacity-75 hover:opacity-100 hover:border-salon-olive/40 transition-all"
    >
      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-200 text-gray-500 shrink-0">
        Cancelada
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-sm text-gray-500 line-through truncate">{app.clientName}</p>
        <p className="text-[10px] font-bold text-gray-400 truncate">
          {startLabel} · {app.services.map((s) => s.name).join(", ")}
        </p>
      </div>
      <span className="text-[10px] font-black text-salon-olive uppercase tracking-wider shrink-0">
        Restaurar ›
      </span>
    </button>
  );
}

function AppointmentCard({
  app, past, isMoving, dimmed, onClick, onPaymentClick, onMoveClick, onCancelMove,
}: {
  app: AgendaAppointment;
  past: boolean;
  isMoving: boolean;
  dimmed: boolean;
  onClick: () => void;
  onPaymentClick: () => void;
  onMoveClick: () => void;
  onCancelMove: () => void;
}) {
  const startMin   = utcDateToChihuahuaMinutes(new Date(app.date));
  const endMin     = utcDateToChihuahuaMinutes(new Date(app.endDate));
  const startLabel = minutesToTimeLabel(startMin);
  const endLabel   = minutesToTimeLabel(endMin);
  const durationMin = endMin > startMin ? endMin - startMin : endMin + 1440 - startMin;
  const price      = getAppointmentAmount(app);
  const free       = isFreeAmount(price);
  const payment    = free
    ? FREE_META
    : PAYMENT_META[app.paymentStatus] ?? PAYMENT_META.PENDING;

  // Las citas pasadas se muestran atenuadas (registro histórico), conservando
  // los botones funcionales para poder ajustar pago/notas a posteriori.
  const cardClasses = past
    ? "bg-gray-50 border-gray-200 text-gray-500 opacity-75"
    : payment.classes;

  return (
    <div className={`w-full rounded-2xl border-2 p-3 transition-all ${cardClasses} ${
      isMoving ? "ring-2 ring-blue-400 ring-offset-2" : ""
    } ${dimmed ? "opacity-40 pointer-events-none" : ""}`}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-black text-sm truncate">{app.clientName}</p>
            <p className="text-[10px] font-bold opacity-70 mt-0.5">{startLabel} – {endLabel} · {durationMin} min</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {app.services.map((s) => (
                <span key={s.id} className="text-[9px] px-1.5 py-0.5 bg-white/60 rounded-md font-bold">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          {free ? (
            <FreeTag className="shrink-0" />
          ) : (
            <SensitiveAmount value={price} className="text-xs font-black shrink-0" />
          )}
        </div>
      </button>

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current/10">
        {/* Pill de pago — clickeable */}
        <button
          onClick={(e) => { e.stopPropagation(); onPaymentClick(); }}
          className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-white/70 hover:bg-white transition-all"
        >
          {payment.label}
          {!free && app.paymentStatus === "PAID" && app.paymentMethod && METHOD_LABELS[app.paymentMethod]
            ? ` · ${METHOD_LABELS[app.paymentMethod]}`
            : ""}
        </button>

        {/* Botón mover — al estar moviendo, actúa como cancelar */}
        <button
          onClick={(e) => { e.stopPropagation(); if (isMoving) onCancelMove(); else onMoveClick(); }}
          className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${
            isMoving
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-white/70 hover:bg-white"
          }`}
        >
          {isMoving ? "✕ Cancelar" : "↕ Mover"}
        </button>

        {/* WhatsApp — solo si la cita tiene teléfono */}
        {app.clientPhone && (
          <a
            href={`https://wa.me/${normalizeWhatsappPhone(app.clientPhone)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center hover:scale-110 transition-all shrink-0"
          >
            <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
          </a>
        )}
      </div>
    </div>
  );
}