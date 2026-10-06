import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { adminPwaMetadata, studioPwaMetadata } from "@/lib/pwa-metadata";
import { STUDIO_HINT_COOKIE } from "@/lib/studio-hint";
import { prisma } from "@/lib/prisma";

// Si el navegador ya conoce el estudio, el login usa su ícono y nombre (para
// que la app instalada de iLoveMe no muestre Tangible al cerrar sesión).
export async function generateMetadata(): Promise<Metadata> {
  const slug = (await cookies()).get(STUDIO_HINT_COOKIE)?.value;
  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    const studio = await prisma.studio
      .findUnique({ where: { slug }, select: { slug: true, shortName: true } })
      .catch(() => null);
    if (studio) return { ...studioPwaMetadata(studio), title: { absolute: `${studio.shortName} · Entrar` } };
  }
  return adminPwaMetadata;
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
