import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * How a client proves who she is on the loyalty page, without an account.
 *
 * Two pieces: a short one-time code the owner reads out at checkout, and a
 * signed cookie the code mints. The NFC sticker carries neither — it is a public
 * bookmark on a counter, so anything written on it is readable by anyone who
 * walks past.
 */

// ── Claim codes ────────────────────────────────────────────────────────────

/**
 * Crockford-style alphabet with the characters people misread removed (I, L, O,
 * U). 32 symbols over 6 places is ~1.07e9 combinations, against at most a
 * handful of live codes in any 15-minute window.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;
/**
 * Long enough that a client who steps outside to find her phone is not locked
 * out, short enough that a code left on a counter is worthless by closing time.
 */
export const CODE_TTL_MINUTES = 30;
/**
 * Enlace mandado por WhatsApp: ella lo abre cuando lo ve, no frente a la
 * dueña. Sigue siendo de un solo uso y solo llega a su propio chat.
 */
export const LINK_TTL_MINUTES = 24 * 60;
/** Wrong guesses a single code tolerates before it stops working. */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * Generates a code with rejection sampling. Taking `byte % 32` would be biased
 * toward the first 16 symbols because 256 is not a multiple of 32 for the values
 * we accept — here every symbol is equally likely.
 */
export function generateClaimCode(): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let code = "";

  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte >= limit) continue;
      code += ALPHABET[byte % ALPHABET.length];
      if (code.length === CODE_LENGTH) break;
    }
  }
  return code;
}

/** Codes are looked up by hash, never stored or compared in plaintext. */
export function hashClaimCode(code: string): string {
  return createHash("sha256").update(normalizeClaimCode(code)).digest("hex");
}

/**
 * Accepts what a person actually types: lower case, spaces, stray dashes.
 *
 * I, L, O and U can never appear in a generated code, so reading them as the
 * digits they are being mistaken for is unambiguous — it can only ever rescue a
 * misread, never turn one valid code into another.
 */
const LOOKALIKES: Record<string, string> = { O: "0", I: "1", L: "1", U: "V" };

export function normalizeClaimCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[OILU]/g, (char) => LOOKALIKES[char]);
}

// ── Device pass ────────────────────────────────────────────────────────────

export const PASS_COOKIE = "tangible_pass";
export const PASS_TTL_DAYS = 180;

/**
 * Its own key, not NEXTAUTH_SECRET. One key, one job: a pass forged from a
 * leaked admin secret would be worse than either problem alone.
 */
function passSecret(): string | null {
  return process.env.REWARDS_PASS_SECRET?.trim() || null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Mints a pass for one customer. Format is `customerId.expiryMs.signature` —
 * the customer id is not a secret (it identifies a row, not a person), and the
 * signature is what makes it unforgeable.
 */
export function createDevicePass(customerId: string): string | null {
  const secret = passSecret();
  if (!secret) return null;

  const expiresAt = Date.now() + PASS_TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${customerId}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Customer id carried by a valid, unexpired pass, or null. */
export function readDevicePass(value: string | undefined): string | null {
  const secret = passSecret();
  if (!secret || !value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [customerId, expiresAt, signature] = parts;
  if (!/^[a-f\d]{24}$/i.test(customerId)) return null;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  const expected = Buffer.from(sign(`${customerId}.${expiresAt}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return null;

  return timingSafeEqual(expected, actual) ? customerId : null;
}

/** Cookie options shared by the routes that set the pass. */
export const PASS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: PASS_TTL_DAYS * 24 * 60 * 60,
} as const;
