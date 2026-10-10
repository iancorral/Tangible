import { headers } from "next/headers";
import { adminBaseFor } from "@/lib/admin-path";

/** Base del panel para la petición actual (ver lib/admin-path.ts). */
export async function getAdminBase(): Promise<string> {
  const h = await headers();
  return adminBaseFor(h.get("x-forwarded-host") ?? h.get("host"));
}
