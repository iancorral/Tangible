import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPwaMetadata, studioPwaMetadata } from "@/lib/pwa-metadata";
import { requireStudio } from "@/lib/tenant";
import type { StudioBrand } from "@/lib/studio-brand";
import { PrivacyProvider } from "@/components/privacy";
import { PRIVACY_COOKIE, isPrivacyEnabled } from "@/lib/privacy";
import AdminShell from "@/components/admin/AdminShell";
import { StudioProvider } from "@/components/admin/StudioContext";
import { getAdminBase } from "@/lib/admin-path.server";

// Ícono, nombre y pantalla de carga de la app instalada según el estudio de la
// sesión: si Alejandra la agrega a su pantalla de inicio, sale iLoveMe.
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireStudio();
  // "absolute" evita la plantilla de la raíz ("%s | Tangible") en otros estudios.
  return ctx
    ? { ...studioPwaMetadata(ctx.studio), title: { absolute: `${ctx.studio.shortName} · Panel` } }
    : adminPwaMetadata;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStudio();
  if (!ctx) redirect("/login");

  const brand: StudioBrand = {
    slug: ctx.studio.slug,
    name: ctx.studio.name,
    shortName: ctx.studio.shortName,
    logoPath: ctx.studio.logoPath,
    features: { rewards: ctx.studio.features.rewards, publicBooking: ctx.studio.features.publicBooking },
    firstName: ctx.firstName,
    adminBase: await getAdminBase(),
  };

  const cookieStore = await cookies();
  const hidden = isPrivacyEnabled(cookieStore.get(PRIVACY_COOKIE)?.value);

  return (
    <StudioProvider brand={brand}>
      <PrivacyProvider initialHidden={hidden}>
        <AdminShell>{children}</AdminShell>
      </PrivacyProvider>
    </StudioProvider>
  );
}
