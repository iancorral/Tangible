/**
 * Estudio (tenant) de cada petición.
 *
 * Regla de oro: toda consulta de datos de negocio lleva `studioId`, y ese
 * `studioId` sale SIEMPRE de aquí — de la sesión en el panel o de
 * PUBLIC_STUDIO_SLUG en el sitio público —, nunca de algo que mande el cliente.
 * Así una cuenta de iLoveMe no puede leer ni tocar datos de Tangible aunque
 * adivine un ID.
 */
import { cache } from "react";
import { getServerSession } from "next-auth";
import type { Studio } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type StudioFeature = keyof Studio["features"];

export type StudioSession = {
  userId: string;
  email: string;
  /** Nombre de pila para el saludo ("Tania"). */
  firstName: string;
  studioId: string;
  studio: Studio;
};

const findStudio = cache(async (id: string) => prisma.studio.findUnique({ where: { id } }));

/**
 * Sesión del panel con su estudio, o null si no hay sesión válida.
 *
 * Las sesiones emitidas antes de que existieran los estudios no traen
 * `studioId`; para no cerrar la sesión de nadie al desplegar, se resuelve por
 * el usuario la primera vez.
 */
export const requireStudio = cache(async (): Promise<StudioSession | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  let { studioId } = session.user;
  const userId = session.user.id;

  if (!studioId && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { studioId: true } });
    studioId = user?.studioId;
  }
  if (!studioId || !userId) return null;

  const studio = await findStudio(studioId);
  if (!studio) return null;

  return {
    userId,
    email: session.user.email ?? "",
    firstName: (session.user.name ?? "").trim().split(/\s+/)[0] || studio.shortName,
    studioId,
    studio,
  };
});

/**
 * Estudio dueño del sitio público de reservas (www). Solo uno: el que diga
 * PUBLIC_STUDIO_SLUG (por defecto "tangible") y que tenga publicBooking.
 */
export const getPublicStudio = cache(async (): Promise<Studio | null> => {
  const slug = process.env.PUBLIC_STUDIO_SLUG?.trim() || "tangible";
  const studio = await prisma.studio.findUnique({ where: { slug } });
  return studio?.features.publicBooking ? studio : null;
});

export function hasFeature(studio: Pick<Studio, "features">, feature: StudioFeature): boolean {
  return studio.features[feature] === true;
}
