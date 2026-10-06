import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasFeature, requireStudio } from "@/lib/tenant";
import { issueClaimCode } from "@/lib/rewards.server";
import { z } from "zod";

const schema = z.object({
  customerId: z.string().regex(/^[a-f\d]{24}$/i, "ID inválido"),
});

/**
 * Issues an enrollment code for a customer. The plaintext is returned exactly
 * once, for the owner to read out; only its hash is stored.
 */
export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  try {
    const validation = schema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: validation.data.customerId, studioId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Clienta no encontrada" }, { status: 404 });
    }

    if (!process.env.REWARDS_PASS_SECRET?.trim()) {
      // Without the signing key a code could be consumed but no pass issued,
      // burning the code for nothing. Fail before that happens.
      console.error("REWARDS_PASS_SECRET is not set; refusing to issue a claim code.");
      return NextResponse.json(
        { error: "Falta configurar la tarjeta digital. Avisa al desarrollador." },
        { status: 503 }
      );
    }

    const { code, expiresAt } = await issueClaimCode(
      studioId,
      customer.id,
      ctx.email
    );

    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
