"use client";

import { NOTE_COLORS, formatNoteDay, formatNoteTime, type NoteDTO } from "@/lib/notes";
import { usePrivacy } from "@/components/privacy";
import { CalendarIcon, LockIcon, PinIcon } from "./icons";

const MAX_VISIBLE_ITEMS = 8;

interface Props {
  note: NoteDTO;
  onOpen: () => void;
  onToggleItem: (itemId: string) => void;
  onTogglePin: () => void;
}

export default function NoteCard({ note, onOpen, onToggleItem, onTogglePin }: Props) {
  const { hidden } = usePrivacy();
  const palette = NOTE_COLORS[note.color];
  // Pendientes primero, hechos al final: lo que falta es lo que se busca.
  const items = [...note.items].sort((a, b) => Number(a.done) - Number(b.done));
  const visible = items.slice(0, MAX_VISIBLE_ITEMS);
  const doneCount = note.items.filter((i) => i.done).length;

  return (
    <article
      className={`group relative break-inside-avoid mb-3 rounded-2xl border-2 ${palette.card} shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* La tarjeta completa abre el editor; los controles internos detienen la
          propagación para que palomear un pendiente no lo abra. */}
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-salon-brown/40"
        aria-label={`Abrir nota ${note.title || "sin título"}`}
      />

      <div className="relative p-4 pointer-events-none">
        <div className="flex items-start gap-2">
          {note.title && (
            <h3 className="flex-1 min-w-0 font-black text-salon-brown text-sm leading-snug break-words">
              {note.title}
            </h3>
          )}
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={note.pinned ? "Desfijar nota" : "Fijar nota"}
            aria-pressed={note.pinned}
            className={`pointer-events-auto ml-auto -mr-1 -mt-1 p-1.5 rounded-full transition-all hover:bg-salon-brown/5 ${
              note.pinned
                ? "text-salon-terracotta"
                : "text-salon-gray/70 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
            }`}
          >
            <PinIcon className="w-4 h-4" filled={note.pinned} />
          </button>
        </div>

        <div className={hidden ? "blur-sm select-none" : undefined} aria-hidden={hidden || undefined}>
          {note.body && (
            <p className="mt-1.5 text-[13px] text-salon-brown/85 whitespace-pre-line break-words line-clamp-[10]">
              {note.body}
            </p>
          )}

          {visible.length > 0 && (
            <ul className="mt-2 space-y-1">
              {visible.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.done}
                    aria-label={item.text}
                    onClick={() => onToggleItem(item.id)}
                    disabled={hidden}
                    className={`pointer-events-auto mt-0.5 w-4 h-4 shrink-0 rounded-[5px] border-2 flex items-center justify-center transition-colors ${
                      item.done
                        ? "bg-salon-olive border-salon-olive text-white"
                        : "border-salon-brown/30 bg-white/70 hover:border-salon-olive"
                    }`}
                  >
                    {item.done && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M2.5 6.5 5 9l4.5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`text-[13px] leading-snug break-words ${
                      item.done ? "line-through text-salon-gray/70" : "text-salon-brown/90"
                    }`}
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {items.length > MAX_VISIBLE_ITEMS && (
            <p className="mt-1 text-[11px] text-salon-gray font-bold">
              +{items.length - MAX_VISIBLE_ITEMS} más
            </p>
          )}
        </div>

        {(note.startAt || note.items.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {note.startAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-salon-brown/10 px-2 py-0.5 text-[10px] font-bold text-salon-brown">
                <CalendarIcon className="w-3 h-3" />
                {formatNoteDay(note.startAt)} · {formatNoteTime(note)}
              </span>
            )}
            {note.blocksSchedule && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-salon-terracotta/10 border border-salon-terracotta/20 px-2 py-0.5 text-[10px] font-bold text-salon-terracotta"
                title="Este horario no aparece disponible en la web"
              >
                <LockIcon className="w-3 h-3" />
                Apartado
              </span>
            )}
            {note.items.length > 0 && (
              <span className="text-[10px] font-bold text-salon-gray tabular-nums ml-auto">
                {doneCount}/{note.items.length}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
