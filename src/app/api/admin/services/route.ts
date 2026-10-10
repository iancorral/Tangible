import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";

/** Catálogo del estudio de la sesión (modales de nueva cita / editar cita). */
export async function GET() {
  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  try {
    const services = await prisma.service.findMany({
      where: { studioId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(services);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
