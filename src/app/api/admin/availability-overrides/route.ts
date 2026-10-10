import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";
import { z } from "zod";
import { chihuahuaToUTC, CHIHUAHUA_UTC_OFFSET } from "@/lib/timezone";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isClosed: z.boolean().default(false),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  note: z.string().max(150).optional(),
});

const deleteSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

function serializeOverride(o: {
  id: string;
  date: Date;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}) {
  const local = new Date(o.date.getTime() - CHIHUAHUA_UTC_OFFSET * 3600000);
  const dateStr = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
  return {
    id: o.id,
    date: dateStr,
    isClosed: o.isClosed,
    startTime: o.startTime,
    endTime: o.endTime,
    note: o.note,
  };
}

export async function GET() {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const now = new Date();
  const chihuahuaNow = new Date(now.getTime() - CHIHUAHUA_UTC_OFFSET * 3600000);
  const y = chihuahuaNow.getUTCFullYear();
  const m = chihuahuaNow.getUTCMonth() + 1;
  const d = chihuahuaNow.getUTCDate();
  const todayStart = chihuahuaToUTC(y, m, d, 0, 0);

  const overrides = await prisma.availabilityOverride.findMany({
    where: { studioId, date: { gte: todayStart } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(overrides.map(serializeOverride));
}

export async function POST(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const body = await req.json();
  const validation = createSchema.safeParse(body);
  if (!validation.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { date, isClosed, startTime, endTime, note } = validation.data;
  const [year, month, day] = date.split("-").map(Number);

  const dayStart = chihuahuaToUTC(year, month, day, 0, 0);
  const dayEnd = chihuahuaToUTC(year, month, day + 1, 0, 0);

  const existing = await prisma.availabilityOverride.findFirst({
    where: { studioId, date: { gte: dayStart, lt: dayEnd } },
  });

  const data = {
    isClosed,
    startTime: isClosed ? null : (startTime ?? null),
    endTime: isClosed ? null : (endTime ?? null),
    note: note ?? null,
  };

  let override;
  if (existing) {
    override = await prisma.availabilityOverride.update({ where: { id: existing.id, studioId }, data });
  } else {
    override = await prisma.availabilityOverride.create({
      data: { studioId, date: new Date(year, month - 1, day, 12, 0, 0), ...data },
    });
  }

  return NextResponse.json(serializeOverride(override), { status: existing ? 200 : 201 });
}

export async function DELETE(req: Request) {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  const body = await req.json();
  const validation = deleteSchema.safeParse(body);
  if (!validation.success) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  // deleteMany con studioId: un ID de otro estudio simplemente no borra nada.
  const { count } = await prisma.availabilityOverride.deleteMany({
    where: { id: validation.data.id, studioId },
  });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
