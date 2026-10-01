import { describe, expect, it } from "vitest";
import { formatNoteTime, isNoteEmpty, noteInputSchema, resolveSchedule, toScheduleInput } from "./notes";

const asDto = (s: ReturnType<typeof resolveSchedule>) => ({
  startAt: s.startAt?.toISOString() ?? null,
  endAt: s.endAt?.toISOString() ?? null,
  allDay: s.allDay,
  blocksSchedule: s.blocksSchedule,
});

describe("resolveSchedule", () => {
  it("hora sin fin dura una hora, en hora de Chihuahua (UTC-6)", () => {
    const r = resolveSchedule({ date: "2026-09-24", startTime: "16:00", endTime: null, blocksSchedule: true });
    expect(r.startAt?.toISOString()).toBe("2026-09-24T22:00:00.000Z");
    expect(r.endAt?.toISOString()).toBe("2026-09-24T23:00:00.000Z");
  });

  it("todo el día va de medianoche a medianoche, cruzando de mes", () => {
    const r = resolveSchedule({ date: "2026-09-30", startTime: null, endTime: null, blocksSchedule: false });
    expect(r.startAt?.toISOString()).toBe("2026-09-30T06:00:00.000Z");
    expect(r.endAt?.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(r.allDay).toBe(true);
  });

  it("sin fecha nunca aparta horario", () => {
    expect(resolveSchedule(null)).toEqual({ startAt: null, endAt: null, allDay: false, blocksSchedule: false });
  });

  it.each([
    { date: "2026-12-05", startTime: "09:15", endTime: "10:45", blocksSchedule: true },
    { date: "2026-12-05", startTime: null, endTime: null, blocksSchedule: false },
  ])("ida y vuelta para el editor: %j", (input) => {
    expect(toScheduleInput(asDto(resolveSchedule(input)))).toEqual(input);
  });

  it("formatea la hora", () => {
    const s = asDto(resolveSchedule({ date: "2026-12-05", startTime: "09:15", endTime: "10:45", blocksSchedule: false }));
    expect(formatNoteTime(s)).toBe("09:15–10:45");
    expect(formatNoteTime({ ...s, allDay: true })).toBe("Todo el día");
  });
});

describe("noteInputSchema", () => {
  it.each([
    [{ color: "bg-red-500" }, "color fuera de la paleta"],
    [{ title: "x".repeat(121) }, "título largo"],
    [{ body: "x".repeat(5001) }, "texto largo"],
    [{ items: Array.from({ length: 51 }, (_, i) => ({ id: `i${i}`, text: "a", done: false })) }, "demasiados pendientes"],
    [{ schedule: { date: "2026-09-24", startTime: "16:00", endTime: "15:00", blocksSchedule: false } }, "fin antes de inicio"],
    [{ schedule: { date: "2026-09-24", startTime: null, endTime: "15:00", blocksSchedule: false } }, "fin sin inicio"],
    [{ schedule: { date: "24/09/2026", startTime: null, endTime: null, blocksSchedule: false } }, "fecha mal formada"],
    [{ pinned: "true" }, "tipo incorrecto"],
  ] as [unknown, string][])("rechaza %j (%s)", (input) => {
    expect(noteInputSchema.safeParse(input).success).toBe(false);
  });

  it("descarta campos que el cliente no debe controlar", () => {
    const parsed = noteInputSchema.parse({ title: " Fisio ", createdBy: "otra", id: "x" });
    expect(parsed).toEqual({ title: "Fisio" });
  });

  it("detecta notas vacías", () => {
    expect(isNoteEmpty({ title: " ", body: "\n", items: [{ text: " " }] })).toBe(true);
    expect(isNoteEmpty({ title: "", body: "", items: [{ text: "leche" }] })).toBe(false);
  });
});
