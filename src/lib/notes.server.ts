/**
 * Lado servidor de las notas. Separado de lib/notes.ts para que los componentes
 * del cliente importen la paleta y la validación sin arrastrar tipos de Prisma.
 */
import type { Note } from "@prisma/client";
import { NOTE_COLORS, type NoteColor, type NoteDTO } from "@/lib/notes";

export function serializeNote(note: Note): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    items: note.items.map((i) => ({ id: i.id, text: i.text, done: i.done })),
    // Una clave que ya no exista en la paleta cae a crema en vez de romper la tarjeta.
    color: (note.color in NOTE_COLORS ? note.color : "CREAM") as NoteColor,
    pinned: note.pinned,
    archived: note.archived,
    startAt: note.startAt?.toISOString() ?? null,
    endAt: note.endAt?.toISOString() ?? null,
    allDay: note.allDay,
    blocksSchedule: note.blocksSchedule,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
