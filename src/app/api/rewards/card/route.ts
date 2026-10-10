import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PASS_COOKIE, readDevicePass } from "@/lib/rewards-access";
import { getStampBalance } from "@/lib/rewards.server";
import { getPublicStudio } from "@/lib/tenant";

// Reads a cookie and a live balance; never cache it.
export const dynamic = "force-dynamic";

/**
 * Current balance for the phone holding the pass. Used by the open card to
 * notice a stamp the owner grants while the client is looking at it.
 *
 * Returns a single number and nothing else — no name, no phone, no history. The
 * page already knows who she is; this only answers "how many now?".
 */
export async function GET() {
  const store = await cookies();
  const customerId = readDevicePass(store.get(PASS_COOKIE)?.value);

  if (!customerId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const studio = await getPublicStudio();
  if (!studio) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  return NextResponse.json(
    { stamps: await getStampBalance(studio.id, customerId) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
