import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/tenant";

export async function GET() {

  const ctx = await requireStudio();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { studioId } = ctx;

  try {
    const appointments = await prisma.appointment.findMany({
      where: { studioId },
      orderBy: { date: "desc" },
      include: { services: true },
    });
    return NextResponse.json(appointments);
  } catch {

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}