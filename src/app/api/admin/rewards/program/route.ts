import { NextResponse } from "next/server";
import { hasFeature, requireStudio } from "@/lib/tenant";
import { REWARD_TYPES } from "@/lib/rewards";
import { getRewardProgram, updateRewardProgram } from "@/lib/rewards.server";
import { z } from "zod";

const programSchema = z.object({
  isActive: z.boolean(),
  // Below 3 the reward is barely earned; above 12 it stops feeling reachable at
  // a salon's visit cadence, and an unreachable card is worse than no card.
  stampsRequired: z.number().int().min(3).max(12),
  rewardType: z.enum(REWARD_TYPES),
  rewardValue: z.number().min(0).max(100000),
  maxRewardValue: z.number().min(0).max(100000).nullable(),
  rewardLabel: z.string().min(3).max(80),
  termsNote: z.string().max(200).nullable(),
});

export async function GET() {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  return NextResponse.json(await getRewardProgram(studioId));
}

export async function PUT(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;
  if (!hasFeature(ctx.studio, "rewards")) {
    return NextResponse.json({ error: "Premios no está activo en este estudio" }, { status: 403 });
  }

  try {
    const validation = programSchema.safeParse(await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const data = validation.data;

    // A percentage over 100 would hand back more than the client owes.
    if (data.rewardType === "PERCENT_DISCOUNT" && data.rewardValue > 100) {
      return NextResponse.json(
        { error: "El descuento no puede pasar de 100%" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await updateRewardProgram(studioId, {
        ...data,
        termsNote: data.termsNote?.trim() || null,
        rewardLabel: data.rewardLabel.trim(),
      })
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
