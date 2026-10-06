/**
 * Marca visible de un estudio en el panel. Se puede importar en el cliente:
 * solo datos públicos (nada de IDs internos).
 */
export type StudioBrand = {
  slug: string;
  /** "iLoveMe Beauty Salon": títulos y mensajes. */
  name: string;
  /** "iLoveMe": nombre de la app instalada y en los mensajes de WhatsApp. */
  shortName: string;
  /** Logo en /public, o null para el wordmark de texto (Tangible). */
  logoPath: string | null;
  features: { rewards: boolean; publicBooking: boolean };
  /** Nombre de pila de quien inició sesión, para el saludo. */
  firstName: string;
  /** "" en admin.<dominio>, "/admin" en otros hosts (ver lib/admin-path.ts). */
  adminBase: string;
};

/**
 * Íconos, manifest y pantallas de carga. Tangible conserva sus archivos
 * originales (/icons, /splash, /manifest.webmanifest); cualquier otro estudio
 * usa los que genera scripts/brand/generate-studio-assets.mjs en
 * /studios/<slug>/.
 */
export function studioAssets(slug: string) {
  if (slug === "tangible") {
    return {
      manifest: "/manifest.webmanifest",
      appleTouchIcon: "/icons/apple-touch-icon.png",
      favicon32: "/icons/favicon-32.png",
      favicon16: "/icons/favicon-16.png",
      icon192: "/icons/icon-192.png",
      splash: (w: number, h: number) => `/splash/splash-${w}x${h}.png`,
    };
  }
  const base = `/studios/${slug}`;
  return {
    manifest: `${base}/manifest.webmanifest`,
    appleTouchIcon: `${base}/apple-touch-icon.png`,
    favicon32: `${base}/favicon-32.png`,
    favicon16: `${base}/favicon-16.png`,
    icon192: `${base}/icon-192.png`,
    splash: (w: number, h: number) => `${base}/splash-${w}x${h}.png`,
  };
}
