import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { prisma } from "@/lib/prisma";
import { STUDIO_HINT_COOKIE } from "@/lib/studio-hint";
import { getAdminBase } from "@/lib/admin-path.server";
import { adminHref } from "@/lib/admin-path";
import { getPanelSession } from "@/lib/tenant";
import { adminPwaMetadata, studioPwaMetadata } from "@/lib/pwa-metadata";

const SLUG = /^[a-z0-9-]+$/;

/**
 * Marca del login (solo apariencia; el estudio real sale de la cuenta):
 *   1. ?studio=<slug>: el enlace propio de cada estudio y su app instalada.
 *   2. La cookie del último estudio que entró en este dispositivo.
 *   3. Tangible.
 */
async function loginBrand(param: string | undefined) {
  const fromCookie = (await cookies()).get(STUDIO_HINT_COOKIE)?.value;
  for (const slug of [param, fromCookie]) {
    if (!slug || !SLUG.test(slug)) continue;
    const studio = await prisma.studio
      .findUnique({ where: { slug }, select: { slug: true, name: true, shortName: true } })
      .catch(() => null);
    if (studio) return studio;
  }
  return null;
}

type Props = { searchParams: Promise<{ cambiada?: string; studio?: string }> };

// Ícono y nombre de la app instalada según el estudio del enlace: agregar a la
// pantalla de inicio desde /login?studio=iloveme instala "iLoveMe".
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const brand = await loginBrand((await searchParams).studio);
  return brand
    ? { ...studioPwaMetadata(brand), title: { absolute: `${brand.shortName} · Entrar` } }
    : adminPwaMetadata;
}

export default async function LoginPage({ searchParams }: Props) {
  const home = adminHref(await getAdminBase(), "/");
  // Con sesión abierta no hay nada que hacer aquí: directo a su panel.
  if (await getPanelSession()) redirect(home);

  const { cambiada, studio } = await searchParams;
  return (
    <LoginForm
      brand={await loginBrand(studio)}
      homeHref={home}
      notice={cambiada ? "Listo, tu contraseña quedó guardada. Entra con la nueva." : null}
    />
  );
}
