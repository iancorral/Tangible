import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { chihuahuaToUTC } from "@/lib/timezone";
import { isNoteEmpty, noteInputSchema, resolveSchedule } from "@/lib/notes";
import { serializeNote } from "@/lib/notes.server";
import type { Prisma } from "@prisma/client";

const MAX_RESULTS = 500;
const MAX_RANGE_DAYS = 62;

const querySchema = z.object({
  view: z.enum(["active", "archived"]).default("active"),
  q: z.string().trim().max(100).optional(),
  // Rango de fechas para el calendario (hora de Chihuahua, ambos inclusive).
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    view: searchParams.get("view") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  const { view, q, from, to } = parsed.data;

  try {
    let where: Prisma.NoteWhereInput;

    if (from || to) {
      // Vista de calendario: toda nota con fecha que toque el rango, archivada
      // o no — archivar la quita del tablero, no borra que ese día pasó algo.
      if (!from || !to) {
        return NextResponse.json({ error: "Rango incompleto" }, { status: 400 });
      }
      const [fy, fm, fd] = from.split("-").map(Number);
      const [ty, tm, td] = to.split("-").map(Number);
      const rangeStart = chihuahuaToUTC(fy, fm, fd, 0, 0);
      const rangeEnd = chihuahuaToUTC(ty, tm, td + 1, 0, 0);
      const days = (rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000;
      if (days <= 0 || days > MAX_RANGE_DAYS) {
        return NextResponse.json({ error: "Rango inválido" }, { status: 400 });
      }
      where = { startAt: { lt: rangeEnd }, endAt: { gt: rangeStart } };
    } else {
      where = { archived: view === "archived" };
      if (q) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
          { items: { some: { text: { contains: q, mode: "insensitive" } } } },
        ];
      }
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: from ? [{ startAt: "asc" }] : [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: MAX_RESULTS,
    });

    return NextResponse.json({ notes: notes.map(serializeNote) });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const parsed = noteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const input = parsed.data;

  const data = {
    title: input.title ?? "",
    body: input.body ?? "",
    items: (input.items ?? []).filter((i) => i.text),
    color: input.color ?? "CREAM",
    pinned: input.pinned ?? false,
    archived: input.archived ?? false,
    ...resolveSchedule(input.schedule ?? null),
  };

  if (isNoteEmpty(data)) {
    return NextResponse.json({ error: "La nota está vacía" }, { status: 400 });
  }

  try {
    const note = await prisma.note.create({
      data: { ...data, createdBy: session.user?.email ?? "admin" },
    });
    return NextResponse.json(serializeNote(note), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
