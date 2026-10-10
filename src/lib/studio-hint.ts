/**
 * Recuerda en el navegador qué estudio entró por última vez, solo para que la
 * pantalla de login muestre su logo (iLoveMe ve iLoveMe al abrir la app). No
 * da acceso a nada: el estudio real siempre sale de la sesión firmada.
 */
export const STUDIO_HINT_COOKIE = "studio_hint";

export function rememberStudio(slug: string): void {
  if (!/^[a-z0-9-]+$/.test(slug)) return;
  document.cookie = `${STUDIO_HINT_COOKIE}=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}
