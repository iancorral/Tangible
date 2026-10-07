import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { getPanelSession } from "@/lib/tenant";
import { getAdminBase } from "@/lib/admin-path.server";
import { adminHref } from "@/lib/admin-path";
import { studioPwaMetadata } from "@/lib/pwa-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPanelSession();
  if (!session) return { title: { absolute: "Cambiar contraseña" } };
  return { ...studioPwaMetadata(session.studio), title: { absolute: `${session.studio.shortName} · Contraseña` } };
}

// Fuera del layout del panel: pantalla sencilla y enfocada, como el login.
export default async function ChangePasswordPage() {
  const session = await getPanelSession();
  if (!session) redirect("/login");

  return (
    <ChangePasswordForm
      forced={session.mustChangePassword}
      firstName={session.firstName}
      email={session.email}
      brand={{ slug: session.studio.slug, name: session.studio.name, shortName: session.studio.shortName }}
      backHref={adminHref(await getAdminBase(), "/")}
    />
  );
}
