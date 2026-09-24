"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NOTE_COLORS,
  NOTE_LIMITS,
  isNoteEmpty,
  toScheduleInput,
  type NoteColor,
  type NoteDTO,
  type NoteInput,
  type NoteItem,
  type NoteScheduleInput,
} from "@/lib/notes";
import { chihuahuaDateKey } from "@/lib/timezone";
import { createNote, deleteNote, newItemId, updateNote } from "./notesApi";
import { ArchiveIcon, CalendarIcon, ChecklistIcon, LockIcon, PinIcon, TrashIcon, XIcon } from "./icons";

const DEFAULT_START = "10:00";
const DEFAULT_END = "11:00";

interface Props {
  /** Nota a editar; sin ella el editor crea una nueva. */
  note?: NoteDTO;
  /** Valores iniciales de una nota nueva (p. ej. la fecha del calendario). */
  initialSchedule?: NoteScheduleInput | null;
  startWithChecklist?: boolean;
  onClose: () => void;
  onSaved: (note: NoteDTO) => void;
  onDeleted?: (id: string) => void;
}

type Draft = {
  title: string;
  body: string;
  items: NoteItem[];
  color: NoteColor;
  pinned: boolean;
  schedule: NoteScheduleInput | null;
};

function toPayload(draft: Draft): NoteInput {
  return {
    title: draft.title.trim(),
    body: draft.body.replace(/\s+$/, ""),
    items: draft.items
      .map((i) => ({ ...i, text: i.text.trim() }))
      .filter((i) => i.text),
    color: draft.color,
    pinned: draft.pinned,
    schedule: draft.schedule,
  };
}

function scheduleError(schedule: NoteScheduleInput | null): string | null {
  if (!schedule) return null;
  if (!schedule.date) return "Elige un día para la nota";
  if (schedule.startTime && schedule.endTime && schedule.endTime <= schedule.startTime) {
    return "La hora de fin debe ser después del inicio";
  }
  return null;
}

export default function NoteEditor({
  note,
  initialSchedule = null,
  startWithChecklist = false,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const initial = useMemo<Draft>(
    () => ({
      title: note?.title ?? "",
      body: note?.body ?? "",
      items:
        note?.items ??
        (startWithChecklist ? [{ id: newItemId(), text: "", done: false }] : []),
      color: note?.color ?? "CREAM",
      pinned: note?.pinned ?? false,
      schedule: note ? toScheduleInput(note) : initialSchedule,
    }),
    // El borrador inicial se fija al abrir; cambios externos no deben pisarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [draft, setDraft] = useState<Draft>(initial);
  const [showList, setShowList] = useState(initial.items.length > 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusItemId, setFocusItemId] = useState<string | null>(
    startWithChecklist && !note ? initial.items[0]?.id ?? null : null
  );
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isNew = !note;
  const initialPayload = useMemo(() => JSON.stringify(toPayload(initial)), [initial]);
  const payload = toPayload(draft);
  const dirty = JSON.stringify(payload) !== initialPayload;

  const update = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  // ── Cerrar = guardar (como Keep). Solo pregunta cuando hay algo que corregir.
  const save = useCallback(async () => {
    if (saving) return;
    if (!dirty) return onClose();

    const empty = isNoteEmpty({
      title: payload.title ?? "",
      body: payload.body ?? "",
      items: payload.items ?? [],
    });
    if (empty) {
      if (isNew) return onClose();
      setError("La nota quedó vacía. Si ya no la necesitas, bórrala.");
      return;
    }
    const schedErr = scheduleError(draft.schedule);
    if (schedErr) {
      setError(schedErr);
      return;
    }

    setSaving(true);
    try {
      const saved = note ? await updateNote(note.id, payload) : await createNote(payload);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la nota");
      setSaving(false);
    }
  }, [saving, dirty, payload, isNew, note, draft.schedule, onClose, onSaved]);

  const toggleArchive = async () => {
    if (!note) return;
    setSaving(true);
    try {
      // Si hubo cambios, se guardan junto con el archivado para no perderlos.
      const patch: NoteInput = dirty ? { ...payload, archived: !note.archived } : { archived: !note.archived };
      const saved = await updateNote(note.id, patch);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo archivar la nota");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!note) return;
    setSaving(true);
    try {
      await deleteNote(note.id);
      onDeleted?.(note.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar la nota");
      setSaving(false);
    }
  };

  // Esc guarda y cierra; Ctrl/⌘+Enter también, para quien escribe rápido.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (confirmDelete) setConfirmDelete(false);
        else save();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, confirmDelete]);

  // Evita que el fondo se desplace detrás del editor en el celular.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!focusItemId) return;
    itemRefs.current.get(focusItemId)?.focus();
    setFocusItemId(null);
  }, [focusItemId, draft.items]);

  // El texto crece con su contenido en lugar de mostrar una barra interna.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.body]);

  // ── Pendientes
  const setItem = (id: string, patch: Partial<NoteItem>) =>
    update({ items: draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  const addItemAfter = (index: number) => {
    if (draft.items.length >= NOTE_LIMITS.items) return;
    const item = { id: newItemId(), text: "", done: false };
    const items = [...draft.items];
    items.splice(index + 1, 0, item);
    update({ items });
    setFocusItemId(item.id);
  };

  const removeItem = (index: number, focusPrevious: boolean) => {
    const items = draft.items.filter((_, i) => i !== index);
    update({ items });
    if (focusPrevious && index > 0) setFocusItemId(draft.items[index - 1].id);
  };

  const toggleList = () => {
    if (showList) {
      // Quitar la lista no borra lo escrito: los pendientes pasan al texto.
      const lines = draft.items.filter((i) => i.text.trim()).map((i) => `• ${i.text.trim()}`);
      update({
        items: [],
        body: lines.length ? [draft.body.trimEnd(), ...lines].filter(Boolean).join("\n") : draft.body,
      });
      setShowList(false);
    } else {
      setShowList(true);
      if (draft.items.length === 0) {
        const item = { id: newItemId(), text: "", done: false };
        update({ items: [item] });
        setFocusItemId(item.id);
      }
    }
  };

  // ── Fecha
  const setSchedule = (patch: Partial<NoteScheduleInput>) => {
    if (!draft.schedule) return;
    update({ schedule: { ...draft.schedule, ...patch } });
  };

  const addSchedule = () =>
    update({
      schedule: {
        date: chihuahuaDateKey(new Date()),
        startTime: null,
        endTime: null,
        blocksSchedule: false,
      },
    });

  const palette = NOTE_COLORS[draft.color];
  const pending = draft.items.filter((i) => !i.done);
  const done = draft.items.filter((i) => i.done);

  const renderItem = (item: NoteItem) => {
    const index = draft.items.findIndex((i) => i.id === item.id);
    return (
      <li key={item.id} className="flex items-center gap-2 group/item">
        <input
          type="checkbox"
          checked={item.done}
          onChange={(e) => setItem(item.id, { done: e.target.checked })}
          aria-label={item.done ? "Marcar como pendiente" : "Marcar como hecho"}
          className="w-4 h-4 shrink-0 accent-salon-olive cursor-pointer"
        />
        <input
          ref={(el) => {
            if (el) itemRefs.current.set(item.id, el);
            else itemRefs.current.delete(item.id);
          }}
          value={item.text}
          maxLength={NOTE_LIMITS.itemText}
          onChange={(e) => setItem(item.id, { text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              addItemAfter(index);
            } else if (e.key === "Backspace" && item.text === "") {
              e.preventDefault();
              removeItem(index, true);
            }
          }}
          placeholder="Pendiente"
          className={`flex-1 min-w-0 bg-transparent py-1 text-sm focus:outline-none placeholder:text-salon-gray/50 ${
            item.done ? "line-through text-salon-gray/70" : "text-salon-brown"
          }`}
        />
        <button
          type="button"
          onClick={() => removeItem(index, false)}
          aria-label="Quitar pendiente"
          className="p-1 text-salon-gray/60 hover:text-salon-terracotta md:opacity-0 md:group-hover/item:opacity-100 focus:opacity-100 transition-opacity"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={save} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Nueva nota" : "Editar nota"}
        className={`relative z-10 w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border-2 shadow-xl ${palette.card}`}
      >
        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-3">
          <div className="flex items-start gap-2">
            <input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={NOTE_LIMITS.title}
              placeholder="Título"
              autoFocus={isNew && !startWithChecklist}
              className="flex-1 min-w-0 bg-transparent text-lg font-black text-salon-brown placeholder:text-salon-gray/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => update({ pinned: !draft.pinned })}
              aria-pressed={draft.pinned}
              aria-label={draft.pinned ? "Desfijar nota" : "Fijar nota"}
              className={`p-2 -mr-2 -mt-1 rounded-full hover:bg-salon-brown/5 ${
                draft.pinned ? "text-salon-terracotta" : "text-salon-gray"
              }`}
            >
              <PinIcon className="w-5 h-5" filled={draft.pinned} />
            </button>
          </div>

          <textarea
            ref={bodyRef}
            value={draft.body}
            onChange={(e) => update({ body: e.target.value })}
            maxLength={NOTE_LIMITS.body}
            placeholder={showList ? "Detalles (opcional)" : "Escribe una nota…"}
            rows={showList ? 1 : 3}
            className="mt-2 w-full resize-none bg-transparent text-sm text-salon-brown leading-relaxed placeholder:text-salon-gray/50 focus:outline-none"
          />

          {showList && (
            <div className="mt-1">
              <ul className="space-y-0.5">{pending.map(renderItem)}</ul>
              {draft.items.length < NOTE_LIMITS.items && (
                <button
                  type="button"
                  onClick={() => addItemAfter(draft.items.length - 1)}
                  className="mt-1 flex items-center gap-2 py-1 text-sm text-salon-gray hover:text-salon-brown"
                >
                  <span className="w-4 text-center font-black">+</span> Agregar pendiente
                </button>
              )}
              {done.length > 0 && (
                <div className="mt-3 pt-2 border-t border-salon-brown/10">
                  <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1">
                    Hechos ({done.length})
                  </p>
                  <ul className="space-y-0.5">{done.map(renderItem)}</ul>
                </div>
              )}
            </div>
          )}

          {/* Fecha */}
          {draft.schedule ? (
            <section className="mt-4 rounded-2xl bg-white/70 border border-salon-brown/10 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-black text-salon-brown uppercase tracking-widest">
                  <CalendarIcon className="w-3.5 h-3.5" /> Fecha
                </p>
                <button
                  type="button"
                  onClick={() => update({ schedule: null })}
                  className="text-[10px] font-bold text-salon-gray hover:text-salon-terracotta underline"
                >
                  Quitar fecha
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={draft.schedule.date}
                  onChange={(e) => setSchedule({ date: e.target.value })}
                  aria-label="Día"
                  className="bg-white border-2 border-salon-brown/10 rounded-xl px-3 py-2 text-sm font-bold text-salon-brown focus:outline-none focus:border-salon-olive/50"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-salon-brown cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.schedule.startTime === null}
                    onChange={(e) =>
                      setSchedule(
                        e.target.checked
                          ? { startTime: null, endTime: null }
                          : { startTime: DEFAULT_START, endTime: DEFAULT_END }
                      )
                    }
                    className="w-4 h-4 accent-salon-olive"
                  />
                  Todo el día
                </label>
              </div>

              {draft.schedule.startTime !== null && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    step={900}
                    value={draft.schedule.startTime}
                    onChange={(e) => setSchedule({ startTime: e.target.value || DEFAULT_START })}
                    aria-label="Hora de inicio"
                    className="bg-white border-2 border-salon-brown/10 rounded-xl px-3 py-2 text-sm font-bold text-salon-brown tabular-nums focus:outline-none focus:border-salon-olive/50"
                  />
                  <span className="text-salon-gray font-bold">–</span>
                  <input
                    type="time"
                    step={900}
                    value={draft.schedule.endTime ?? ""}
                    onChange={(e) => setSchedule({ endTime: e.target.value || null })}
                    aria-label="Hora de fin"
                    className="bg-white border-2 border-salon-brown/10 rounded-xl px-3 py-2 text-sm font-bold text-salon-brown tabular-nums focus:outline-none focus:border-salon-olive/50"
                  />
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <span className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={draft.schedule.blocksSchedule}
                    onChange={(e) => setSchedule({ blocksSchedule: e.target.checked })}
                    className="peer sr-only"
                  />
                  <span className="block w-9 h-5 rounded-full bg-salon-gray/30 peer-checked:bg-salon-terracotta transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-salon-terracotta/40" />
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </span>
                <span>
                  <span className="flex items-center gap-1 text-xs font-black text-salon-brown">
                    <LockIcon className="w-3 h-3" /> Apartar este horario
                  </span>
                  <span className="block text-[11px] text-salon-gray leading-snug">
                    {draft.schedule.startTime === null
                      ? "Las clientas no podrán reservar en la web ese día."
                      : "Las clientas no podrán reservar en la web a esa hora."}{" "}
                    Tú sí puedes agendar desde el panel.
                  </span>
                </span>
              </label>
            </section>
          ) : null}

          {error && (
            <p role="alert" className="mt-3 text-xs text-red-700 font-bold bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}
        </div>

        {/* Barra inferior */}
        <div className="border-t border-salon-brown/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs font-bold text-salon-brown px-2">
                ¿Borrar esta nota? No se puede deshacer.
              </p>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-salon-gray hover:text-salon-brown"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-salon-terracotta text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                Borrar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
              <div className="flex w-full sm:w-auto items-center justify-center sm:justify-start gap-2 sm:gap-1.5 px-1" role="radiogroup" aria-label="Color de la nota">
                {(Object.keys(NOTE_COLORS) as NoteColor[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === key}
                    aria-label={NOTE_COLORS[key].label}
                    title={NOTE_COLORS[key].label}
                    onClick={() => update({ color: key })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${NOTE_COLORS[key].swatch} ${
                      draft.color === key ? "ring-2 ring-offset-1 ring-salon-brown/60 scale-110" : "hover:scale-110"
                    }`}
                  />
                ))}
              </div>

              <div className="flex w-full sm:w-auto items-center justify-end sm:ml-auto">
                <ToolButton label={showList ? "Quitar lista" : "Lista de pendientes"} active={showList} onClick={toggleList}>
                  <ChecklistIcon className="w-[18px] h-[18px]" />
                </ToolButton>
                {!draft.schedule && (
                  <ToolButton label="Agregar fecha" onClick={addSchedule}>
                    <CalendarIcon className="w-[18px] h-[18px]" />
                  </ToolButton>
                )}
                {note && (
                  <>
                    <ToolButton label={note.archived ? "Sacar del archivo" : "Archivar"} onClick={toggleArchive} disabled={saving}>
                      <ArchiveIcon className="w-[18px] h-[18px]" />
                    </ToolButton>
                    <ToolButton label="Borrar" onClick={() => setConfirmDelete(true)} disabled={saving}>
                      <TrashIcon className="w-[18px] h-[18px]" />
                    </ToolButton>
                  </>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="ml-1 px-4 py-2 rounded-xl bg-salon-brown text-white text-[11px] font-black uppercase tracking-widest hover:bg-salon-brown/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Guardando…" : "Listo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
        active ? "text-salon-olive bg-salon-olive/10" : "text-salon-gray hover:text-salon-brown hover:bg-salon-brown/5"
      }`}
    >
      {children}
    </button>
  );
}
