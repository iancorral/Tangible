import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { adminPwaMetadata } from "@/lib/pwa-metadata";
import { PrivacyProvider } from "@/components/privacy";
import { PRIVACY_COOKIE, isPrivacyEnabled } from "@/lib/privacy";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = adminPwaMetadata;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const hidden = isPrivacyEnabled(cookieStore.get(PRIVACY_COOKIE)?.value);

  return (
    <PrivacyProvider initialHidden={hidden}>
      <AdminShell>{children}</AdminShell>
    </PrivacyProvider>
  );
}
