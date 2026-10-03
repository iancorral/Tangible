import { describe, expect, it } from "vitest";
import { cleanText, fieldErrors, optionalPhoneSchema, personNameSchema, phoneSchema } from "./validation";
import { z } from "zod";

describe("personNameSchema", () => {
  it.each([
    ["Dania Peña", "Dania Peña"],
    ["Dania Peña", "Dania Peña"], // ñ tecleada como n + tilde combinante
    ["‪Dania Peña‬", "Dania Peña"], // copiado de Contactos/WhatsApp en iOS
    ["Dania Peña 💅✨", "Dania Peña"],
    ["  D’Angelo ", "D'Angelo"],
    ["Chloè Müller", "Chloè Müller"],
    ["María  José\tLópez", "María José López"],
  ])("acepta y limpia %j", (input, expected) => {
    expect(personNameSchema.parse(input)).toBe(expected);
  });

  it("deja la ñ en su forma compuesta (un solo carácter)", () => {
    expect(personNameSchema.parse("Peña")).toHaveLength(4);
  });

  it.each(["💅", "A", "Karla 2", "<script>", "-Ana", "x".repeat(101)])("rechaza %j", (input) => {
    expect(personNameSchema.safeParse(input).success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it.each([
    "614 270 8576",
    "‪+52 1 614 270 8576‬",
    "+52 (614) 270-8576",
    "614 270 8576",
    "5216142708576",
  ])("normaliza %j a 10 dígitos", (input) => {
    expect(phoneSchema.parse(input)).toBe("6142708576");
  });

  it("explica por qué rechaza", () => {
    expect(phoneSchema.safeParse("270 8576").error?.issues[0].message).toMatch(/10 dígitos/);
    expect(phoneSchema.safeParse("614-ABC-8576").error?.issues[0].message).toMatch(/números/);
  });
});

describe("optionalPhoneSchema", () => {
  it.each(["", "   ", null, undefined])("%j significa sin teléfono", (input) => {
    expect(optionalPhoneSchema.parse(input)).toBeNull();
  });

  it("valida cuando hay número", () => {
    expect(optionalPhoneSchema.parse("614 270 8576")).toBe("6142708576");
    expect(optionalPhoneSchema.safeParse("123").error?.issues[0].message).toMatch(/10 dígitos/);
  });
});

describe("cleanText / fieldErrors", () => {
  it("quita marcas invisibles y colapsa espacios", () => {
    expect(cleanText("​ a   b ﻿")).toBe("a b");
  });

  it("devuelve el primer mensaje por campo, sin la estructura del esquema", () => {
    const schema = z.object({ clientName: personNameSchema, clientPhone: phoneSchema });
    const result = schema.safeParse({ clientName: "A", clientPhone: "1" });
    expect(fieldErrors(result.error!)).toEqual({
      clientName: "El nombre es muy corto",
      clientPhone: "El teléfono debe tener 10 dígitos",
    });
  });
});
