"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Service } from "@/types";

interface Props {
  services: Service[];
  bookingDate: { date: Date; time: string } | null;
  onRemove: (service: Service) => void;
  onContinue: () => void;
  continueDisabled: boolean;
  formOpen: boolean;
}

/**
 * "Tu cita" en escritorio: el resumen vive a la vista junto a los pasos, como
 * en los sistemas de reserva de salones (Fresha, Booksy), en lugar de una barra
 * flotante que en pantallas grandes queda lejos de todo.
 */
export default function BookingSummary({ services, bookingDate, onRemove, onContinue, continueDisabled, formOpen }: Props) {
  const total = services.reduce((acc, s) => acc + s.price, 0);
  const minutes = services.reduce((acc, s) => acc + s.duration, 0);

  return (
    <section aria-label="Tu cita" className="rounded-3xl border-2 border-salon-brown/10 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-salon-olive">Tu cita</h2>

      {services.length === 0 ? (
        <p className="mt-3 text-sm text-salon-gray">Elige uno o más servicios para ver tu resumen aquí.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-salon-brown/5">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-salon-brown">{s.name}</span>
                  <span className="text-[11px] text-salon-gray">{s.duration} min</span>
                </span>
                <span className="text-sm font-black text-salon-brown tabular-nums">${s.price}</span>
                {!formOpen && (
                  <button
                    type="button"
                    onClick={() => onRemove(s)}
                    aria-label={`Quitar ${s.name}`}
                    className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-salon-gray hover:bg-salon-terracotta/10 hover:text-salon-terracotta"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1.5 border-t border-salon-brown/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-salon-gray">Duración</dt>
              <dd className="font-bold text-salon-brown">{minutes} min</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-salon-gray">Fecha</dt>
              <dd className="font-bold text-salon-brown first-letter:uppercase">
                {bookingDate ? `${format(bookingDate.date, "EEE d MMM", { locale: es })} · ${bookingDate.time}` : "Por elegir"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-salon-gray">Total desde</dt>
              <dd className="text-2xl font-black text-salon-brown tabular-nums">${total}</dd>
            </div>
          </dl>

          {!formOpen && (
            <button
              type="button"
              onClick={onContinue}
              disabled={continueDisabled}
              className="mt-4 w-full rounded-2xl bg-salon-olive py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-salon-olive/90 disabled:cursor-not-allowed disabled:bg-salon-gray/20 disabled:text-salon-gray"
            >
              {continueDisabled ? "Elige fecha y hora" : "Continuar"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
