import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { z } from "zod";

const scheduleSchema = z.array(
  z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isDayOff: z.boolean(),
  })
);

export async function GET() {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const schedule = await prisma.workSchedule.findMany({
    where: { studioId },
    orderBy: { dayOfWeek: "asc" },
  });

  if (schedule.length === 0) {
    return NextResponse.json(
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        dayOfWeek: day,
        startTime: "10:00",
        endTime: "19:00",
        isDayOff: day === 0, 
      }))
    );
  }

  return NextResponse.json(schedule);
}

export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  try {
    const body = await req.json();
    const validation = scheduleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Solo el horario de ESTE estudio: sin el filtro se borraba el de todos.
    await prisma.workSchedule.deleteMany({ where: { studioId } });
    await prisma.workSchedule.createMany({
      data: validation.data.map((day) => ({ ...day, studioId })),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}