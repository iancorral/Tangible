"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import MuralDecorations from "@/components/layout/MuralDecorations";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type DaySchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
};

type BlockedDate = {
  id: string;
  date: string;
  reason?: string;
};

type AvailabilityOverride = {
  id: string;
  date: string;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

function parseDateLabel(dateStr: string) {
  // dateStr is "YYYY-MM-DD"; parse at noon to avoid timezone shifts in display
  return format(new Date(dateStr + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es });
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [minDate, setMinDate] = useState("");

  // Override state
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideClosed, setNewOverrideClosed] = useState(false);
  const [newOverrideStart, setNewOverrideStart] = useState("10:00");
  const [newOverrideEnd, setNewOverrideEnd] = useState("19:00");
  const [newOverrideNote, setNewOverrideNote] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    // Calculamos "hoy" solo en el cliente para usar el reloj/zona horaria del
    // navegador y evitar desajustes de hidratación con el servidor (UTC).
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

    Promise.all([
      fetch("/api/admin/schedule").then((r) => r.json()),
      fetch("/api/admin/blocked-dates").then((r) => r.json()),
      fetch("/api/admin/availability-overrides").then((r) => r.json()),
    ]).then(([sched, blocked, ovr]) => {
      setSchedule(sched);
      setBlockedDates(blocked);
      setOverrides(ovr);
      setLoadingSchedule(false);
    });
  }, []);

  const updateDay = (dayOfWeek: number, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  const saveSchedule = async () => {
    setSaving(true);
    await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addBlockedDate = async () => {
    if (!newBlockDate) return;
    const res = await fetch("/api/admin/blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newBlockDate, reason: newBlockReason }),
    });
    if (res.ok) {
      const created = await res.json();
      setBlockedDates((prev) => [...prev, created]);
      setNewBlockDate("");
      setNewBlockReason("");
    }
  };

  const removeBlockedDate = async (id: string) => {
    await fetch("/api/admin/blocked-dates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
  };

  const addOverride = async () => {
    if (!newOverrideDate) return;
    if (!newOverrideClosed && (!newOverrideStart || !newOverrideEnd)) return;
    setSavingOverride(true);
    const res = await fetch("/api/admin/availability-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: newOverrideDate,
        isClosed: newOverrideClosed,
        startTime: newOverrideClosed ? undefined : newOverrideStart,
        endTime: newOverrideClosed ? undefined : newOverrideEnd,
        note: newOverrideNote || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setOverrides((prev) => {
        // upsert: replace if same date exists
        const idx = prev.findIndex((o) => o.date === created.date);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = created;
          return next.sort((a, b) => a.date.localeCompare(b.date));
        }
        return [...prev, created].sort((a, b) => a.date.localeCompare(b.date));
      });
      setNewOverrideDate("");
      setNewOverrideNote("");
      setNewOverrideClosed(false);
      setNewOverrideStart("10:00");
      setNewOverrideEnd("19:00");
    }
    setSavingOverride(false);
  };

  const removeOverride = async (id: string) => {
    await fetch("/api/admin/availability-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setOverrides((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <main className="min-h-[100dvh] p-4 md:p-10 bg-salon-bg relative">
      <MuralDecorations />
      <div className="max-w-2xl mx-auto relative z-10">

        <header className="mb-8">
          <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
            Mi Horario
          </h1>
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-8 bg-salon-terracotta"></div>
            <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              Configura tu disponibilidad
            </p>
          </div>
        </header>

        {/* Horario semanal */}
        <section className="bg-white rounded-2xl border-2 border-salon-olive/20 shadow-folk p-4 md:p-6 mb-6">
          <h2 className="text-xs font-black text-salon-olive uppercase tracking-widest mb-1">
            Horario semanal base
          </h2>
          <p className="text-xs text-salon-gray mb-5">
            Plantilla recurrente. Los horarios específicos por fecha (abajo) tienen prioridad sobre esta plantilla.
          </p>

          {loadingSchedule ? (
            <div className="text-center py-8 text-salon-gray animate-pulse text-xs uppercase tracking-widest">
              Cargando horario...
            </div>
          ) : (
            <div className="space-y-3">
              {schedule.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border transition-all ${
                    day.isDayOff ? "bg-gray-50 border-gray-200 opacity-60" : "bg-salon-bg border-salon-olive/20"
                  }`}
                >
                  <button
                    onClick={() => updateDay(day.dayOfWeek, "isDayOff", !day.isDayOff)}
                    className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                      day.isDayOff ? "bg-gray-100 border-gray-300 text-gray-400" : "bg-salon-olive border-salon-olive text-white"
                    }`}
                  >
                    {day.isDayOff ? "✕" : "✓"}
                  </button>

                  <span className={`font-black uppercase tracking-wide text-[11px] sm:text-sm w-16 sm:w-20 shrink-0 ${day.isDayOff ? "text-gray-400" : "text-salon-brown"}`}>
                    {DAYS[day.dayOfWeek]}
                  </span>

                  {!day.isDayOff ? (
                    // Los inputs comparten el espacio disponible (flex-1) y se
                    // encogen sin desbordar en pantallas estrechas.
                    <div className="flex items-center gap-1.5 sm:gap-1 flex-1 min-w-0">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => updateDay(day.dayOfWeek, "startTime", e.target.value)}
                        className="border-2 border-salon-olive/30 rounded-lg px-2 py-1.5 sm:py-1 text-sm text-salon-brown font-bold focus:border-salon-olive outline-none bg-white flex-1 min-w-0 max-w-[130px] sm:max-w-[110px]"
                      />
                      <span className="text-salon-gray text-xs font-bold shrink-0">a</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => updateDay(day.dayOfWeek, "endTime", e.target.value)}
                        className="border-2 border-salon-olive/30 rounded-lg px-2 py-1.5 sm:py-1 text-sm text-salon-brown font-bold focus:border-salon-olive outline-none bg-white flex-1 min-w-0 max-w-[130px] sm:max-w-[110px]"
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Día libre</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={saveSchedule}
            disabled={saving}
            className="mt-6 w-full py-3 bg-salon-olive text-white font-black text-xs uppercase tracking-widest rounded-xl border-2 border-salon-olive hover:bg-salon-olive/90 transition-all disabled:opacity-50"
          >
            {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar horario"}
          </button>
        </section>

        {/* Horarios específicos por fecha */}
        <section className="bg-white rounded-2xl border-2 border-salon-lavender/30 shadow-folk p-4 md:p-6 mb-6">
          <h2 className="text-xs font-black text-salon-lavender uppercase tracking-widest mb-1">
            Horarios específicos por fecha
          </h2>
          <p className="text-xs text-salon-gray mb-4">
            Para días con horario distinto al habitual. Sobreescriben el horario semanal en esa fecha concreta.
          </p>

          {/* Add override form */}
          <div className="space-y-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={newOverrideDate}
                onChange={(e) => setNewOverrideDate(e.target.value)}
                min={minDate}
                className="border-2 border-salon-lavender/30 rounded-lg px-3 py-2 text-sm text-salon-brown font-bold focus:border-salon-lavender outline-none bg-white flex-1"
              />
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border-2 border-salon-lavender/30 rounded-lg bg-white shrink-0 select-none">
                <input
                  type="checkbox"
                  checked={newOverrideClosed}
                  onChange={(e) => setNewOverrideClosed(e.target.checked)}
                  className="accent-salon-terracotta w-4 h-4"
                />
                <span className="text-xs font-black uppercase tracking-wider text-salon-gray">Cerrado ese día</span>
              </label>
            </div>

            {!newOverrideClosed && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={newOverrideStart}
                  onChange={(e) => setNewOverrideStart(e.target.value)}
                  className="border-2 border-salon-lavender/30 rounded-lg px-2 py-2 text-sm text-salon-brown font-bold focus:border-salon-lavender outline-none bg-white flex-1"
                />
                <span className="text-salon-gray text-xs font-bold shrink-0">a</span>
                <input
                  type="time"
                  value={newOverrideEnd}
                  onChange={(e) => setNewOverrideEnd(e.target.value)}
                  className="border-2 border-salon-lavender/30 rounded-lg px-2 py-2 text-sm text-salon-brown font-bold focus:border-salon-lavender outline-none bg-white flex-1"
                />
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newOverrideNote}
                onChange={(e) => setNewOverrideNote(e.target.value)}
                placeholder="Nota (opcional, ej: cita fuera del salón)"
                className="border-2 border-salon-lavender/30 rounded-lg px-3 py-2 text-sm text-salon-brown focus:border-salon-lavender outline-none bg-white flex-1"
              />
              <button
                onClick={addOverride}
                disabled={savingOverride || !newOverrideDate}
                className="px-5 py-2 bg-salon-lavender text-white font-black text-sm uppercase rounded-lg hover:bg-salon-lavender/80 transition-colors shrink-0 disabled:opacity-40"
              >
                {savingOverride ? "..." : "+"}
              </button>
            </div>
          </div>

          {/* Override list */}
          {overrides.length === 0 ? (
            <p className="text-center text-salon-gray text-xs py-4 uppercase tracking-wider">
              Sin horarios específicos programados
            </p>
          ) : (
            <div className="space-y-2">
              {overrides.map((ov) => (
                <div key={ov.id} className="flex items-center justify-between bg-salon-bg rounded-lg px-3 py-2 border border-salon-lavender/20">
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-salon-brown text-sm block truncate capitalize">
                      {parseDateLabel(ov.date)}
                    </span>
                    <span className={`text-xs font-bold ${ov.isClosed ? "text-salon-terracotta" : "text-salon-olive"}`}>
                      {ov.isClosed ? "Cerrado" : `${ov.startTime} – ${ov.endTime}`}
                    </span>
                    {ov.note && (
                      <span className="text-salon-gray text-xs ml-2">— {ov.note}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeOverride(ov.id)}
                    className="text-red-400 hover:text-red-600 font-black text-sm ml-3 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Días bloqueados */}
        <section className="bg-white rounded-2xl border-2 border-salon-terracotta/20 shadow-folk p-4 md:p-6">
          <h2 className="text-xs font-black text-salon-terracotta uppercase tracking-widest mb-1">
            Días bloqueados
          </h2>
          <p className="text-xs text-salon-gray mb-4">
            Vacaciones, permisos, imprevistos — estos días no aparecerán disponibles para las clientas.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="date"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              min={minDate}
              className="border-2 border-salon-terracotta/30 rounded-lg px-3 py-2 text-sm text-salon-brown font-bold focus:border-salon-terracotta outline-none bg-white flex-1"
            />
            <input
              type="text"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              placeholder="Razón (opcional)"
              className="border-2 border-salon-terracotta/30 rounded-lg px-3 py-2 text-sm text-salon-brown focus:border-salon-terracotta outline-none bg-white flex-1"
            />
            <button
              onClick={addBlockedDate}
              className="px-5 py-2 bg-salon-terracotta text-white font-black text-sm uppercase rounded-lg hover:bg-salon-terracotta/80 transition-colors shrink-0"
            >
              +
            </button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-center text-salon-gray text-xs py-4 uppercase tracking-wider">
              Sin días bloqueados
            </p>
          ) : (
            <div className="space-y-2">
              {blockedDates.map((bd) => (
                <div key={bd.id} className="flex items-center justify-between bg-salon-bg rounded-lg px-3 py-2 border border-salon-terracotta/20">
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-salon-brown text-sm block truncate">
                      {format(new Date(bd.date), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                    {bd.reason && (
                      <span className="text-salon-gray text-xs">— {bd.reason}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeBlockedDate(bd.id)}
                    className="text-red-400 hover:text-red-600 font-black text-sm ml-3 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
