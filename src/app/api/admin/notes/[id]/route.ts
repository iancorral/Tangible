import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isNoteEmpty, noteInputSchema, resolveSchedule } from "@/lib/notes";
import { serializeNote } from "@/lib/notes.server";

const OBJECT_ID = /^[a-f\d]{24}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  if (!OBJECT_ID.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

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
  const { schedule, items, ...rest } = parsed.data;

  try {
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }

    const data = {
      ...rest,
      ...(items !== undefined ? { items: items.filter((i) => i.text) } : {}),
      ...(schedule !== undefined ? resolveSchedule(schedule) : {}),
    };

    // La regla de "no vacía" se evalúa sobre el resultado, no sobre el parche:
    // fijar una nota no manda texto y aun así es válido.
    if (
      isNoteEmpty({
        title: data.title ?? existing.title,
        body: data.body ?? existing.body,
        items: data.items ?? existing.items,
      })
    ) {
      return NextResponse.json({ error: "La nota está vacía" }, { status: 400 });
    }

    const note = await prisma.note.update({ where: { id }, data });
    return NextResponse.json(serializeNote(note));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  if (!OBJECT_ID.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const { count } = await prisma.note.deleteMany({ where: { id } });
    if (count === 0) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
