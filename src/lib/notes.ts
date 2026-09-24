import { z } from "zod";
import { chihuahuaToUTC, chihuahuaDateKey, formatChihuahuaTime } from "@/lib/timezone";

// Paleta de notas, derivada de los colores de Tangible en versión pastel para
// que el texto café siempre se lea bien. La base de datos guarda solo la clave;
// las clases viven aquí para que Tailwind las detecte y el cliente nunca pueda
// inyectar estilos arbitrarios.
export const NOTE_COLORS = {
  CREAM: { label: "Crema",     card: "bg-white border-salon-gray/15",              swatch: "bg-white border-salon-gray/30" },
  BLUSH: { label: "Rosa",      card: "bg-[#FBEAF2] border-salon-lavender/25",      swatch: "bg-[#F4C6DC] border-salon-lavender/40" },
  HONEY: { label: "Miel",      card: "bg-[#F8EDD6] border-salon-honey/40",         swatch: "bg-[#EBCF97] border-salon-honey/60" },
  SAGE:  { label: "Olivo",     card: "bg-[#EEF0E0] border-salon-olive/25",         swatch: "bg-[#CDD3A8] border-salon-olive/40" },
  CLAY:  { label: "Terracota", card: "bg-[#F8E4DA] border-salon-terracotta/25",    swatch: "bg-[#EDB9A2] border-salon-terracotta/40" },
  SKY:   { label: "Cielo",     card: "bg-[#E6EEF1] border-[#8FAAB6]/40",           swatch: "bg-[#B9CDD6] border-[#8FAAB6]/60" },
} as const;

export type NoteColor = keyof typeof NOTE_COLORS;
const COLOR_KEYS = Object.keys(NOTE_COLORS) as [NoteColor, ...NoteColor[]];

export const NOTE_LIMITS = {
  title: 120,
  body: 5000,
  items: 50,
  itemText: 200,
} as const;

// Sin hora de fin, una nota con hora ocupa una hora: lo típico de "fisio".
const DEFAULT_DURATION_MINUTES = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const itemSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().max(NOTE_LIMITS.itemText),
  done: z.boolean(),
});

const scheduleSchema = z
  .object({
    date: z.string().regex(DATE_RE),
    startTime: z.string().regex(TIME_RE).nullable(),
    endTime: z.string().regex(TIME_RE).nullable(),
    blocksSchedule: z.boolean(),
  })
  .refine((s) => s.startTime !== null || s.endTime === null, {
    message: "Hora de fin sin hora de inicio",
  })
  .refine((s) => !s.startTime || !s.endTime || s.endTime > s.startTime, {
    message: "La hora de fin debe ser después del inicio",
  });

export type NoteScheduleInput = z.infer<typeof scheduleSchema>;

// Todos los campos son opcionales para que PATCH mande solo lo que cambió
// (fijar, archivar, palomear un pendiente). `schedule: null` quita la fecha.
export const noteInputSchema = z.object({
  title: z.string().trim().max(NOTE_LIMITS.title).optional(),
  body: z.string().max(NOTE_LIMITS.body).optional(),
  items: z.array(itemSchema).max(NOTE_LIMITS.items).optional(),
  color: z.enum(COLOR_KEYS).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  schedule: scheduleSchema.nullable().optional(),
});

export type NoteInput = z.infer<typeof noteInputSchema>;

export type NoteItem = z.infer<typeof itemSchema>;

/** Forma en que la API entrega una nota al cliente. */
export type NoteDTO = {
  id: string;
  title: string;
  body: string;
  items: NoteItem[];
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  blocksSchedule: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Convierte la fecha capturada (hora de Chihuahua) en el intervalo UTC que se guarda. */
export function resolveSchedule(schedule: NoteScheduleInput | null) {
  if (!schedule) {
    return { startAt: null, endAt: null, allDay: false, blocksSchedule: false };
  }

  const [y, m, d] = schedule.date.split("-").map(Number);

  if (!schedule.startTime) {
    return {
      startAt: chihuahuaToUTC(y, m, d, 0, 0),
      endAt: chihuahuaToUTC(y, m, d + 1, 0, 0),
      allDay: true,
      blocksSchedule: schedule.blocksSchedule,
    };
  }

  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const startAt = chihuahuaToUTC(y, m, d, sh, sm);
  let endAt: Date;
  if (schedule.endTime) {
    const [eh, em] = schedule.endTime.split(":").map(Number);
    endAt = chihuahuaToUTC(y, m, d, eh, em);
  } else {
    endAt = new Date(startAt.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  }

  return { startAt, endAt, allDay: false, blocksSchedule: schedule.blocksSchedule };
}

/** Inverso de resolveSchedule, para precargar el editor. */
export function toScheduleInput(note: Pick<NoteDTO, "startAt" | "endAt" | "allDay" | "blocksSchedule">): NoteScheduleInput | null {
  if (!note.startAt) return null;
  const start = new Date(note.startAt);
  return {
    date: chihuahuaDateKey(start),
    startTime: note.allDay ? null : formatChihuahuaTime(start),
    endTime: note.allDay || !note.endAt ? null : formatChihuahuaTime(new Date(note.endAt)),
    blocksSchedule: note.blocksSchedule,
  };
}

/** Una nota sin título, texto ni pendientes no guarda nada útil. */
export function isNoteEmpty(note: { title: string; body: string; items: { text: string }[] }) {
  return !note.title.trim() && !note.body.trim() && !note.items.some((i) => i.text.trim());
}

const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "Hoy", "Mañana" o "jue 24 sep", siempre en hora de Chihuahua. */
export function formatNoteDay(startAt: string, now: Date = new Date()): string {
  const start = new Date(startAt);
  const key = chihuahuaDateKey(start);
  if (key === chihuahuaDateKey(now)) return "Hoy";
  if (key === chihuahuaDateKey(new Date(now.getTime() + 86_400_000))) return "Mañana";
  if (key === chihuahuaDateKey(new Date(now.getTime() - 86_400_000))) return "Ayer";
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[weekday]} ${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "16:00–17:00" o "Todo el día". */
export function formatNoteTime(note: Pick<NoteDTO, "startAt" | "endAt" | "allDay">): string {
  if (!note.startAt || note.allDay) return "Todo el día";
  const start = formatChihuahuaTime(new Date(note.startAt));
  return note.endAt ? `${start}–${formatChihuahuaTime(new Date(note.endAt))}` : start;
}
