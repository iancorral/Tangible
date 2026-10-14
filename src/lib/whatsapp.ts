import { BUSINESS_NAME } from "@/lib/config/business";
import { formatChihuahuaDate, formatChihuahuaTime } from "@/lib/timezone";

export type AppointmentMessageData = {
  clientName: string;
  /** Nombre del estudio que escribe ("Tangible", "iLoveMe"). */
  studioName?: string;
  date: Date | string;
  serviceNames: string[];
};

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

export function normalizeWhatsappPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("52")) return digits;    
  if (digits.length === 10) return `52${digits}`; 
  return digits;                                   
}

export function buildWhatsAppUrl(rawPhone: string, message: string): string {
  return `https://wa.me/${normalizeWhatsappPhone(rawPhone)}?text=${encodeURIComponent(message)}`;
}

function appointmentLines(a: AppointmentMessageData): string[] {
  const date = asDate(a.date);
  return [
    `FECHA: ${formatChihuahuaDate(date)}`,
    `HORA: ${formatChihuahuaTime(date)} hrs`,
    `SERVICIOS: ${a.serviceNames.join(", ")}`,
  ];
}

export function buildConfirmationMessage(a: AppointmentMessageData): string {
  return [
    `Hola ${firstName(a.clientName)}, te escribo de ${a.studioName ?? "Tangible"}!`,
    ``,
    `Tu cita ha quedado agendada:`,
    ``,
    ...appointmentLines(a),
    ``,
    `Si necesitas reagendar, mandame mensaje ¡Te espero!`,
  ].join("\n");
}
export function buildReminderMessage(a: AppointmentMessageData): string {
  return [
    `Hola ${firstName(a.clientName)}!`,
    ``,
    `Para recordarte que mañana tienes cita:`,
    ``,
    ...appointmentLines(a),
    ``,
    `¿Me confirmas tu asistencia? Responde *Sí* para confirmar o escríbeme si necesitas reagendar. ¡Te espero!`,
  ].join("\n");
}

export function buildClientBookingRequestMessage(opts: {
  dateLabel: string;
  timeLabel: string;
  serviceNames: string[];
  durationMinutes: number;
}): string {
  return [
    `Hola ${BUSINESS_NAME}.`,
    ``,
    `Soy *una clienta nueva* (reservé en la web).`,
    ``,
    `FECHA: ${opts.dateLabel} a las ${opts.timeLabel}`,
    `SERVICIOS: ${opts.serviceNames.join(", ")}`,
    `DURACIÓN: ${opts.durationMinutes} min`,
    ``,
    `¿Queda confirmada mi cita?`,
  ].join("\n");
}

/** Enlace personal para activar la tarjeta de sellos desde su celular. */
export function buildCardLinkMessage(opts: { clientName: string; studioName?: string; url: string }): string {
  return [
    `Hola ${firstName(opts.clientName)}, te escribo de ${opts.studioName ?? "Tangible"}!`,
    ``,
    `Aquí está tu tarjeta de sellos digital. Ábrela con este enlace (es solo para ti y funciona una vez):`,
    opts.url,
    ``,
    `Después, en cada cita acerca tu celular al sticker del estudio y tu sello cae solito.`,
  ].join("\n");
}

export function buildConfirmationUrl(phone: string, a: AppointmentMessageData): string {
  return buildWhatsAppUrl(phone, buildConfirmationMessage(a));
}

export function buildReminderUrl(phone: string, a: AppointmentMessageData): string {
  return buildWhatsAppUrl(phone, buildReminderMessage(a));
}
