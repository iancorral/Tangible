import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

/**
 * Text pasted from a phone is rarely what it looks like. Copying a contact on
 * iOS or from WhatsApp wraps it in invisible bidi marks (U+202A…U+202C), some
 * keyboards produce "ñ" as "n" + a combining tilde, and contact names often
 * carry emoji. All of that looks fine on screen and used to fail validation
 * with no visible reason, so inputs are cleaned first and validated after.
 */

// Zero-width chars, bidi controls, word joiners and BOM: never meaningful in a
// name or a phone number, and impossible to spot when they cause a rejection.
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/g;
// Emoji and their glue (variation selectors, ZWJ is covered above, skin tones).
const PICTOGRAPHIC = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}︎️]/gu;

export function cleanText(raw: string): string {
  return raw.normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

function cleanName(raw: string): string {
  return cleanText(raw.replace(PICTOGRAPHIC, ""))
    // The iPhone keyboard types ’ by default; store one apostrophe, not two.
    .replace(/[‘’ʼ]/g, "'");
}

/** Any script's letters and accents, plus the punctuation real names use. */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u;

export const personNameSchema = z
  .string()
  .transform(cleanName)
  .pipe(
    z
      .string()
      .min(2, "El nombre es muy corto")
      .max(100, "El nombre es muy largo")
      .regex(NAME_PATTERN, "El nombre solo puede llevar letras, espacios, puntos, guiones o apóstrofos")
  );

/**
 * A phone number in any common format ("614 270 8576", "+52 1 (614) 270-8576",
 * pasted with invisible marks…) reduced to its canonical digits. Rejects only
 * what cannot identify anyone, with a message that says why.
 */
function parsePhone(raw: string, ctx: z.RefinementCtx): string {
  if (/[^\d\s\-().+]/.test(raw)) {
    ctx.addIssue({ code: "custom", message: "El teléfono solo puede llevar números" });
    return z.NEVER;
  }
  const phone = normalizePhone(raw);
  if (!phone || phone.length > 15) {
    ctx.addIssue({ code: "custom", message: "El teléfono debe tener 10 dígitos" });
    return z.NEVER;
  }
  return phone;
}

export const phoneSchema = z.string().transform((raw, ctx) => parsePhone(cleanText(raw), ctx));

/** Optional phone: empty, whitespace-only or absent means "no phone" (null). */
export const optionalPhoneSchema = z
  .string()
  .nullish()
  .transform((raw, ctx) => {
    const cleaned = cleanText(raw ?? "");
    return cleaned ? parsePhone(cleaned, ctx) : null;
  });

/**
 * Flattens a zod error into { field: firstMessage } for the client. Unlike
 * `error.format()` it does not echo the schema's internal structure back.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
