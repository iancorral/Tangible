import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicStudio } from '@/lib/tenant';

export async function GET() {
  try {
    // Catálogo del estudio dueño del sitio público (Tangible).
    const studio = await getPublicStudio();
    if (!studio) return NextResponse.json([], { status: 200 });

    const services = await prisma.service.findMany({
      where: { studioId: studio.id, isActive: true },
    });

    return NextResponse.json(services, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}