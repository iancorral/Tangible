import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { z } from "zod";

const blockedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(100).optional(),
});

export async function GET() {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const dates = await prisma.blockedDate.findMany({
    where: { studioId, date: { gte: new Date() } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(dates);
}

export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  try {
    const body = await req.json();
    const validation = blockedDateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const [y, m, d] = validation.data.date.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);

    const blocked = await prisma.blockedDate.create({
      data: { studioId, date, reason: validation.data.reason },
    });
    return NextResponse.json(blocked, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  try {
    const { id } = await req.json();
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const { count } = await prisma.blockedDate.deleteMany({ where: { id, studioId } });
    if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}