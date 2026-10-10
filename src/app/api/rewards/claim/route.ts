import { NextResponse } from "next/server";
import { PASS_COOKIE, PASS_COOKIE_OPTIONS, createDevicePass } from "@/lib/rewards-access";
import { allowClaimAttempt, clientIp, consumeClaimCode } from "@/lib/rewards.server";
import { getPublicStudio, hasFeature } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(4).max(16),
});

/**
 * Public. Exchanges a one-time code for a device pass.
 *
 * This is the only unauthenticated endpoint in the rewards module that writes
 * anything, so it is the one worth being careful with:
 *
 *  - Every failure returns the same message. Telling the caller whether a code
 *    exists, expired, or was already used would turn this into an oracle.
 *  - Rate limited per IP, on top of the per-code attempt cap.
 *  - The response carries no customer data. It sets the cookie; the page reads
 *    the card server-side on the next render.
 */
export async function POST(req: Request) {
  const GENERIC = "Código inválido o vencido. Pide uno nuevo en el estudio.";

  try {
    if (!(await allowClaimAttempt(clientIp(req)))) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429 }
      );
    }

    const validation = schema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: GENERIC }, { status: 400 });
    }

    // Checked BEFORE the code is consumed. Consuming first would burn a valid
    // single-use code and then fail to hand back a pass, leaving the client
    // holding a code that can never work again.
    if (!process.env.REWARDS_PASS_SECRET?.trim()) {
      console.error("REWARDS_PASS_SECRET is not set; cannot issue a device pass.");
      return NextResponse.json(
        { error: "La tarjeta digital no está disponible. Avisa en el estudio." },
        { status: 503 }
      );
    }

    const studio = await getPublicStudio();
    if (!studio || !hasFeature(studio, "rewards")) {
      return NextResponse.json({ error: GENERIC }, { status: 400 });
    }

    const result = await consumeClaimCode(studio.id, validation.data.code);
    if (!result.ok) {
      return NextResponse.json({ error: GENERIC }, { status: 400 });
    }

    const pass = createDevicePass(result.customerId);
    if (!pass) {
      console.error("REWARDS_PASS_SECRET disappeared mid-request.");
      return NextResponse.json(
        { error: "La tarjeta digital no está disponible. Avisa en el estudio." },
        { status: 503 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(PASS_COOKIE, pass, PASS_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
