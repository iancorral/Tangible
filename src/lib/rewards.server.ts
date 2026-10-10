/**
 * Data access for the rewards module. Separate from lib/rewards.ts so the rules
 * can be imported by client components without pulling the Prisma client into
 * the browser bundle.
 */
import { createHash } from "node:crypto";
import type { Prisma, RewardProgram } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNSPENT_STAMP } from "@/lib/rewards";
import {
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  generateClaimCode,
  hashClaimCode,
  normalizeClaimCode,
} from "@/lib/rewards-access";

/** Reads the studio's program, creating it with the defaults on first use. */
export async function getRewardProgram(studioId: string): Promise<RewardProgram> {
  return prisma.rewardProgram.upsert({
    where: { studioId },
    update: {},
    create: { studioId },
  });
}

export async function updateRewardProgram(
  studioId: string,
  data: Prisma.RewardProgramUpdateInput
): Promise<RewardProgram> {
  return prisma.rewardProgram.upsert({
    where: { studioId },
    update: data,
    create: { ...(data as Prisma.RewardProgramUncheckedCreateInput), studioId },
  });
}

/** Unspent stamps for one customer. The balance is always derived, never stored. */
export async function getStampBalance(studioId: string, customerId: string): Promise<number> {
  return prisma.stamp.count({ where: { studioId, customerId, ...UNSPENT_STAMP } });
}

// ── Enrollment ─────────────────────────────────────────────────────────────

/**
 * Issues a fresh code for a customer and retires any earlier unused one, so
 * only the code the owner is reading out right now can work.
 *
 * Returns the plaintext exactly once; only its hash is stored.
 */
export async function issueClaimCode(
  studioId: string,
  customerId: string,
  createdBy: string
): Promise<{ code: string; expiresAt: Date }> {
  await prisma.claimCode.updateMany({
    where: { studioId, customerId, consumedAt: null },
    data: { expiresAt: new Date(0) },
  });

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // The retry only guards against an astronomically unlikely hash collision
  // with a code that is still live.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateClaimCode();
    try {
      await prisma.claimCode.create({
        data: {
          studioId,
          codeHash: hashClaimCode(code),
          customerId,
          expiresAt,
          consumedAt: null,
          createdBy,
        },
      });
      return { code, expiresAt };
    } catch {
      // Collision on codeHash: draw another.
    }
  }

  throw new Error("Could not issue a unique claim code");
}

/** Distinguishes failures for logging, never for the client. */
export type ClaimResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" | "ATTEMPTS" };

/**
 * Consumes a code. The single-use guarantee is the conditional update: the row
 * only flips to consumed if it is still unconsumed, so two people racing the
 * same code cannot both enrol.
 */
export async function consumeClaimCode(studioId: string, raw: string): Promise<ClaimResult> {
  const code = normalizeClaimCode(raw);
  if (code.length !== 6) return { ok: false, reason: "INVALID" };

  // Un código de otro estudio no se encuentra: igual que uno inexistente.
  const record = await prisma.claimCode.findUnique({
    where: { codeHash: hashClaimCode(code), studioId },
  });
  if (!record) return { ok: false, reason: "INVALID" };

  if (record.consumedAt) return { ok: false, reason: "USED" };
  if (record.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "ATTEMPTS" };

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.claimCode.update({
      where: { id: record.id, studioId },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "EXPIRED" };
  }

  const claimed = await prisma.claimCode.updateMany({
    where: { id: record.id, studioId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: "USED" };

  // First activation is when she became a member; later devices do not reset it.
  //
  // Both halves of the OR are needed: the 48 customers created by the backfill
  // have no `joinedAt` field at all, and on MongoDB `joinedAt: null` does not
  // match an absent field. Without the isSet half no existing client would ever
  // get a join date.
  await prisma.customer.updateMany({
    where: {
      id: record.customerId,
      studioId,
      OR: [{ joinedAt: null }, { joinedAt: { isSet: false } }],
    },
    data: { joinedAt: new Date() },
  });

  return { ok: true, customerId: record.customerId };
}

// ── Rate limiting ──────────────────────────────────────────────────────────

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_WINDOW = 20;

/** Best-effort client address behind Vercel's proxy. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window counter for the public claim endpoint. Returns false once the
 * window is spent.
 *
 * A database round trip per attempt is the point: this endpoint is public and
 * mutates state, and the studio sees a few hundred taps a month. Redis would be
 * a dependency and a bill to solve a problem that has not happened.
 */
export async function allowClaimAttempt(ip: string): Promise<boolean> {
  const now = Date.now();
  const windowMs = WINDOW_MINUTES * 60 * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  // Hashed so the counters never hold a raw address.
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);

  // Opportunistic pruning: cheap, and keeps the collection from growing forever
  // without a TTL index Prisma cannot express.
  if (Math.random() < 0.02) {
    await prisma.claimAttempt
      .deleteMany({ where: { windowStart: { lt: new Date(now - 2 * windowMs) } } })
      .catch(() => {});
  }

  try {
    const row = await prisma.claimAttempt.upsert({
      where: { ipHash_windowStart: { ipHash, windowStart } },
      update: { count: { increment: 1 } },
      create: { ipHash, windowStart, count: 1 },
    });
    return row.count <= MAX_ATTEMPTS_PER_WINDOW;
  } catch {
    // Two requests racing on the unique index. Losing that race is not a reason
    // to lock someone out of her own card.
    return true;
  }
}
