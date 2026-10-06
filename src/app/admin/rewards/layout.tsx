import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/tenant";
import { getAdminBase } from "@/lib/admin-path.server";
import { adminHref } from "@/lib/admin-path";

// Solo para estudios con Premios encendido; los demás regresan al inicio.
export default async function RewardsFeatureLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudio();
  if (!ctx?.studio.features.rewards) redirect(adminHref(await getAdminBase(), "/"));
  return children;
}
