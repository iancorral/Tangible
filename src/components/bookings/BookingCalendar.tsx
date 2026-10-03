"use client";

import { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface BookingCalendarProps {
  onDateTimeSelect: (date: Date, time: string) => void;
  totalDuration: number;
}

export default function BookingCalendar({ onDateTimeSelect, totalDuration }: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [result, setResult] = useState<{ key: string; times: string[] } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const today = new Date();
  const nextDays = Array.from({ length: 10 }, (_, i) => addDays(today, i));

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const reqKey = dateStr ? `${dateStr}|${totalDuration}` : null;

  const error = reqKey && errorKey === reqKey ? "No pudimos cargar los horarios." : null;
  const loadingTimes = !!reqKey && result?.key !== reqKey && errorKey !== reqKey;
  const availableTimes = result?.key === reqKey ? result.times : [];

  useEffect(() => {
    if (!reqKey || !dateStr) return;
    let cancelled = false;

    fetch(`/api/availability?date=${dateStr}&duration=${totalDuration}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Error al conectar con el servidor.");
        return res.json();
      })
      .then((times) => {
        if (!cancelled) setResult({ key: reqKey, times });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setErrorKey(reqKey);
      });

    return () => {
      cancelled = true;
    };
  }, [reqKey, dateStr, totalDuration]);

  return (
    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="font-bold text-salon-olive text-xs uppercase tracking-[0.2em] mb-4">
        Elige tu fecha
      </h3>

      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-5 no-scrollbar touch-pan-x scroll-touch sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {nextDays.map((date) => {
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            return (
              <button
                key={date.toString()}
                onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                aria-pressed={!!isSelected}
                className={`
                  snap-start flex-shrink-0 w-[72px] sm:w-auto h-24 flex flex-col items-center justify-center border-2 transition-all duration-300
                  /* APLICAMOS CLASE HAND-DRAWN (Bordes orgánicos) */
                  hand-drawn
                  ${isSelected 
                    ? 'bg-salon-brown border-salon-brown text-salon-white shadow-folk-purple transform scale-105' 
                    : 'bg-white border-salon-gray/20 text-salon-brown hover:border-salon-olive'
                  }
                `}
              >
                <span className="text-[10px] uppercase tracking-widest mb-1 font-bold opacity-80">
                  {format(date, 'EEE', { locale: es })}
                </span>
                <span className="text-2xl font-black">
                  {format(date, 'd')}
                </span>
              </button>
            );
        })}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-salon-terracotta text-xs font-bold text-center hand-drawn border border-red-100">
          {error}
        </div>
      )}

      {selectedDate && !error && (
        <div className="mt-2 animate-in fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-[1px] w-full bg-salon-olive/20"></div>
            <p className="text-xs text-salon-gray whitespace-nowrap uppercase tracking-wider font-bold">
              Horarios para <span className="text-salon-terracotta">{format(selectedDate, 'EEEE d', { locale: es })}</span>
            </p>
            <div className="h-[1px] w-full bg-salon-olive/20"></div>
          </div>
          
          {loadingTimes ? (
            <div className="text-center py-8 text-salon-gray animate-pulse text-xs tracking-widest uppercase">Buscando espacios...</div>
          ) : availableTimes.length === 0 ? (
            <div className="text-center py-6 text-salon-terracotta bg-white rounded-xl border-2 border-salon-terracotta/20 hand-drawn">
              <p className="font-bold text-sm">Agenda llena este día</p>
              <p className="text-xs mt-1">Por favor selecciona otra fecha</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
              {availableTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => { setSelectedTime(time); onDateTimeSelect(selectedDate, time); }}
                  aria-pressed={selectedTime === time}
                  className={`
                    py-3 text-sm font-bold transition-all duration-200 border-2 hand-drawn
                    ${selectedTime === time 
                      ? 'bg-salon-lavender text-white border-salon-lavender shadow-folk'
                      : 'bg-white text-salon-brown border-salon-gray/20 hover:border-salon-olive hover:text-salon-olive'
                    }
                  `}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}