import { cookies } from "next/headers";
import LoginForm from "@/components/auth/LoginForm";
import { prisma } from "@/lib/prisma";
import { STUDIO_HINT_COOKIE } from "@/lib/studio-hint";
import { getAdminBase } from "@/lib/admin-path.server";
import { adminHref } from "@/lib/admin-path";

/** Marca del último estudio que entró en este navegador (solo apariencia). */
async function hintedBrand() {
  const slug = (await cookies()).get(STUDIO_HINT_COOKIE)?.value;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  const studio = await prisma.studio
    .findUnique({ where: { slug }, select: { name: true, shortName: true, logoPath: true } })
    .catch(() => null);
  return studio;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ cambiada?: string }> }) {
  const { cambiada } = await searchParams;
  return (
    <LoginForm
      brand={await hintedBrand()}
      homeHref={adminHref(await getAdminBase(), "/")}
      notice={cambiada ? "Listo, tu contraseña quedó guardada. Entra con la nueva." : null}
    />
  );
}
