/**
 * Dónde vive el panel.
 *
 * En producción el panel es su propio subdominio (admin.studiotangible.com.mx)
 * y sus direcciones son limpias: /calendar, /notes. En cualquier otro host
 * (tu PC, el celular por IP, las vistas previas de Vercel) sigue bajo /admin.
 * proxy.ts traduce un modo al otro; los enlaces se arman con adminHref().
 */
export const ADMIN_PREFIX = "/admin";

export function isAdminHost(host: string | null | undefined): boolean {
  return !!host && host.toLowerCase().startsWith("admin.");
}

/** "" en el subdominio admin, "/admin" en cualquier otro host. */
export function adminBaseFor(host: string | null | undefined): string {
  return isAdminHost(host) ? "" : ADMIN_PREFIX;
}

/** adminHref("", "/calendar") → "/calendar"; adminHref("/admin", "/") → "/admin". */
export function adminHref(base: string, path: string): string {
  const clean = path === "/" ? "" : path;
  return base + clean || "/";
}
