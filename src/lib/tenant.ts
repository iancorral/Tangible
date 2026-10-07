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
  /** Entró con una contraseña temporal: debe cambiarla antes de usar el panel. */
  mustChangePassword: boolean;
};

const findStudio = cache(async (id: string) => prisma.studio.findUnique({ where: { id } }));

/**
 * Sesión firmada + la cuenta tal como está HOY en la base, o null.
 *
 * Se consulta la cuenta en cada petición (una lectura pequeña, memorizada por
 * petición) para que los cambios surtan efecto al instante: una cuenta borrada
 * deja de entrar, y al cambiar la contraseña las sesiones anteriores dejan de
 * valer — aunque su token firmado todavía no haya vencido.
 */
export const getPanelSession = cache(async (): Promise<StudioSession | null> => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studioId: true, email: true, name: true, mustChangePassword: true, passwordChangedAt: true },
  });
  if (!user) return null;

  // Token emitido antes del último cambio de contraseña: ya no vale.
  const issuedAtMs = (session.user.issuedAt ?? 0) * 1000;
  if (user.passwordChangedAt && issuedAtMs < user.passwordChangedAt.getTime() - 1000) return null;

  const studio = await findStudio(user.studioId);
  if (!studio) return null;

  return {
    userId,
    email: user.email,
    firstName: user.name.trim().split(/\s+/)[0] || studio.shortName,
    studioId: user.studioId,
    studio,
    mustChangePassword: user.mustChangePassword === true,
  };
});

/**
 * Sesión lista para usar el panel y sus APIs. Una cuenta con contraseña
 * temporal no pasa de aquí hasta cambiarla (ver /cambiar-contrasena).
 */
export const requireStudio = cache(async (): Promise<StudioSession | null> => {
  const session = await getPanelSession();
  return session && !session.mustChangePassword ? session : null;
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
