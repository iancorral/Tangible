import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PASS_COOKIE, readDevicePass } from "@/lib/rewards-access";
import { claimTapStamp, getStampBalance } from "@/lib/rewards.server";
import { getPublicStudio, hasFeature } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * La tarjeta se abrió (normalmente por el sticker NFC): si hoy tiene cita y
 * aún no se lleva el sello de esa cita, se lo da.
 *
 * Es POST a propósito: abrir la página no debe cambiar nada por sí solo
 * (prefetch, vistas previas de enlaces, bots). Lo llama la tarjeta al
 * montarse. Repetirlo es inofensivo: un sello por cita, no por toque.
 */
export async function POST() {
  const store = await cookies();
  const customerId = readDevicePass(store.get(PASS_COOKIE)?.value);
  if (!customerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const studio = await getPublicStudio();
  if (!studio || !hasFeature(studio, "rewards")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const granted = await claimTapStamp(studio.id, customerId);
    return NextResponse.json(
      { granted, stamps: await getStampBalance(studio.id, customerId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Sello por NFC:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
