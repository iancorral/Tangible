"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MuralDecorations from "@/components/layout/MuralDecorations";
import { PrivacyToggle } from "@/components/privacy";
import NoteCard from "@/components/notes/NoteCard";
import NoteEditor from "@/components/notes/NoteEditor";
import { listNotes, updateNote } from "@/components/notes/notesApi";
import { CalendarIcon, ChecklistIcon } from "@/components/notes/icons";
import { formatNoteDay, type NoteDTO, type NoteInput, type NoteScheduleInput } from "@/lib/notes";
import { chihuahuaDateKey } from "@/lib/timezone";

type Tab = "NOTES" | "AGENDA" | "ARCHIVE";

const TABS: { id: Tab; label: string }[] = [
  { id: "NOTES", label: "Notas" },
  { id: "AGENDA", label: "Con fecha" },
  { id: "ARCHIVE", label: "Archivo" },
];

type EditorState =
  | { mode: "edit"; note: NoteDTO }
  | { mode: "new"; checklist?: boolean; schedule?: NoteScheduleInput }
  | null;

type Toast = { message: string; undo?: () => void } | null;

function sortBoard(notes: NoteDTO[]) {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
  );
}

export default function NotesPage() {
  const [tab, setTab] = useState<Tab>("NOTES");
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [showPast, setShowPast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = tab === "ARCHIVE" ? "archived" : "active";

  const showToast = useCallback((next: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Búsqueda en el servidor (incluye el texto de los pendientes), con retardo
  // para no disparar una petición por tecla.
  useEffect(() => {
    let cancelled = false;
    const q = term.trim();
    const timeout = setTimeout(() => {
      setLoading(true);
      listNotes({ view, q: q || undefined })
        .then((data) => {
          if (cancelled) return;
          setNotes(data);
          setLoadError(false);
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, q ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [view, term]);

  // ── Mutaciones
  const belongsToView = useCallback(
    (note: NoteDTO) => (view === "archived" ? note.archived : !note.archived),
    [view]
  );

  const upsert = useCallback(
    (note: NoteDTO) => {
      setNotes((prev) => {
        const rest = prev.filter((n) => n.id !== note.id);
        return belongsToView(note) ? sortBoard([note, ...rest]) : rest;
      });
    },
    [belongsToView]
  );

  /** Cambio optimista: se ve al instante y se revierte si el servidor falla. */
  const patchOptimistic = useCallback(
    async (note: NoteDTO, patch: NoteInput, preview: Partial<NoteDTO>) => {
      setNotes((prev) => sortBoard(prev.map((n) => (n.id === note.id ? { ...n, ...preview } : n))));
      try {
        upsert(await updateNote(note.id, patch));
      } catch {
        setNotes((prev) => sortBoard(prev.map((n) => (n.id === note.id ? note : n))));
        showToast({ message: "No se pudo guardar el cambio" });
      }
    },
    [upsert, showToast]
  );

  const togglePin = (note: NoteDTO) =>
    patchOptimistic(note, { pinned: !note.pinned }, { pinned: !note.pinned });

  const toggleItem = (note: NoteDTO, itemId: string) => {
    const items = note.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    patchOptimistic(note, { items }, { items });
  };

  const handleSaved = (saved: NoteDTO) => {
    const previous = editor?.mode === "edit" ? editor.note : null;
    upsert(saved);

    if (previous && previous.archived !== saved.archived) {
      showToast({
        message: saved.archived ? "Nota archivada" : "Nota restaurada",
        undo: async () => {
          setToast(null);
          try {
            upsert(await updateNote(saved.id, { archived: previous.archived }));
          } catch {
            showToast({ message: "No se pudo deshacer" });
          }
        },
      });
    }
  };

  const handleDeleted = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    showToast({ message: "Nota borrada" });
  };

  // ── Vistas derivadas
  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const others = useMemo(() => notes.filter((n) => !n.pinned), [notes]);

  const agenda = useMemo(() => {
    const todayKey = chihuahuaDateKey(new Date());
    const dated = notes
      .filter((n) => n.startAt)
      .sort((a, b) => a.startAt!.localeCompare(b.startAt!));

    const group = (list: NoteDTO[]) => {
      const days = new Map<string, NoteDTO[]>();
      for (const n of list) {
        const key = chihuahuaDateKey(new Date(n.startAt!));
        days.set(key, [...(days.get(key) ?? []), n]);
      }
      return [...days.entries()];
    };

    const upcoming = dated.filter((n) => chihuahuaDateKey(new Date(n.startAt!)) >= todayKey);
    const past = dated.filter((n) => chihuahuaDateKey(new Date(n.startAt!)) < todayKey).reverse();
    return { upcoming: group(upcoming), past: group(past), pastCount: past.length };
  }, [notes]);

  const newDatedNote = () =>
    setEditor({
      mode: "new",
      schedule: { date: chihuahuaDateKey(new Date()), startTime: null, endTime: null, blocksSchedule: false },
    });

  const renderGrid = (list: NoteDTO[]) => (
    <div className="columns-2 md:columns-3 gap-3">
      {list.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onOpen={() => setEditor({ mode: "edit", note })}
          onTogglePin={() => togglePin(note)}
          onToggleItem={(itemId) => toggleItem(note, itemId)}
        />
      ))}
    </div>
  );

  const sectionLabel = (text: string) => (
    <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-2 px-1">{text}</p>
  );

  const emptyState = (title: string, hint: string) => (
    <div className="text-center py-16 px-6 border-2 border-dashed border-salon-gray/20 rounded-3xl">
      <p className="text-salon-brown font-black text-sm uppercase tracking-wider">{title}</p>
      <p className="text-xs text-salon-gray mt-1">{hint}</p>
    </div>
  );

  const searching = term.trim().length > 0;

  return (
    <main className="min-h-screen p-4 md:p-10 relative bg-salon-bg">
      <MuralDecorations />

      <div className="max-w-4xl mx-auto relative z-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs text-salon-gray font-bold uppercase tracking-wider hover:text-salon-brown mb-4 block"
            >
              ← Volver al panel
            </Link>
            <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
              Notas
            </h1>
            <div className="flex items-center gap-3 opacity-70">
              <div className="h-[2px] w-8 bg-salon-terracotta" />
              <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
                Pendientes, ideas y recordatorios
              </p>
            </div>
          </div>
          <PrivacyToggle />
        </header>

        {/* Captura rápida */}
        <div className="flex items-center gap-1 bg-white border-2 border-salon-honey/40 rounded-2xl shadow-sm mb-5 pr-2">
          <button
            type="button"
            onClick={() => setEditor({ mode: "new" })}
            className="flex-1 text-left px-4 py-3.5 text-sm text-salon-gray/80 font-medium"
          >
            Escribe una nota…
          </button>
          <button
            type="button"
            onClick={() => setEditor({ mode: "new", checklist: true })}
            aria-label="Nueva lista de pendientes"
            title="Nueva lista"
            className="p-2.5 rounded-full text-salon-gray hover:text-salon-olive hover:bg-salon-olive/10 transition-colors"
          >
            <ChecklistIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={newDatedNote}
            aria-label="Nueva nota con fecha"
            title="Nota con fecha"
            className="p-2.5 rounded-full text-salon-gray hover:text-salon-terracotta hover:bg-salon-terracotta/10 transition-colors"
          >
            <CalendarIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas + búsqueda */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex bg-white/70 border-2 border-salon-gray/10 rounded-2xl p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  tab === t.id ? "bg-salon-brown text-white shadow-sm" : "text-salon-gray hover:text-salon-brown"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label htmlFor="note-search" className="sr-only">Buscar en notas</label>
          <input
            id="note-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar…"
            className="flex-1 bg-white border-2 border-salon-gray/10 rounded-2xl px-4 py-2.5 text-sm text-salon-brown font-bold placeholder:text-salon-gray/60 placeholder:font-normal focus:outline-none focus:border-salon-olive/50 transition-colors"
          />
        </div>

        {loading ? (
          <div className="columns-2 md:columns-3 gap-3">
            {[120, 80, 160, 96, 140, 72].map((h, i) => (
              <div key={i} className="break-inside-avoid mb-3 rounded-2xl bg-white border-2 border-salon-gray/10 animate-pulse" style={{ height: h }} />
            ))}
          </div>
        ) : loadError ? (
          emptyState("No se pudieron cargar las notas", "Revisa tu conexión y vuelve a intentarlo.")
        ) : tab === "NOTES" ? (
          notes.length === 0 ? (
            searching
              ? emptyState("Sin resultados", "Prueba con otra palabra.")
              : emptyState("Aún no hay notas", "Anota el tianguis, la fisio o lo que necesites recordar.")
          ) : (
            <div className="space-y-6">
              {pinned.length > 0 && (
                <section>
                  {sectionLabel("Fijadas")}
                  {renderGrid(pinned)}
                </section>
              )}
              {others.length > 0 && (
                <section>
                  {pinned.length > 0 && sectionLabel("Otras")}
                  {renderGrid(others)}
                </section>
              )}
            </div>
          )
        ) : tab === "AGENDA" ? (
          agenda.upcoming.length === 0 && agenda.pastCount === 0 ? (
            emptyState("Nada con fecha", "Agrega una fecha a una nota para verla aquí y en el calendario.")
          ) : (
            <div className="space-y-6">
              {agenda.upcoming.length === 0 && emptyState("Nada próximo", "Las notas con fecha pasada están abajo.")}
              {agenda.upcoming.map(([key, list]) => (
                <section key={key}>
                  {sectionLabel(formatNoteDay(list[0].startAt!))}
                  {renderGrid(list)}
                </section>
              ))}
              {agenda.pastCount > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPast((v) => !v)}
                    className="w-full text-[10px] font-black uppercase tracking-widest text-salon-gray border border-dashed border-salon-gray/30 rounded-xl px-3 py-2 hover:bg-white/60 transition-all"
                  >
                    {showPast ? "Ocultar pasadas" : `Ver pasadas (${agenda.pastCount})`}
                  </button>
                  {showPast && (
                    <div className="space-y-6 mt-4 opacity-80">
                      {agenda.past.map(([key, list]) => (
                        <section key={key}>
                          {sectionLabel(formatNoteDay(list[0].startAt!))}
                          {renderGrid(list)}
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : notes.length === 0 ? (
          emptyState(searching ? "Sin resultados" : "Archivo vacío", "Las notas que archives quedan guardadas aquí.")
        ) : (
          renderGrid(notes)
        )}
      </div>

      {editor && (
        <NoteEditor
          key={editor.mode === "edit" ? editor.note.id : "new"}
          note={editor.mode === "edit" ? editor.note : undefined}
          initialSchedule={editor.mode === "new" ? editor.schedule ?? null : null}
          startWithChecklist={editor.mode === "new" && editor.checklist}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-salon-brown text-white rounded-2xl pl-5 pr-3 py-3 shadow-xl text-xs font-bold"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={toast.undo}
              className="px-3 py-1 rounded-lg text-salon-honey font-black uppercase tracking-wider hover:bg-white/10"
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </main>
  );
}
