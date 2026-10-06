import type { Metadata } from "next";
import { studioAssets } from "@/lib/studio-brand";

/** Pantallas de iPhone para las que existe una imagen de carga. */
const IOS_SCREENS: [cssW: number, cssH: number, ratio: number, pxW: number, pxH: number][] = [
  [320, 568, 2, 640, 1136],   // iPhone SE 1ª gen
  [375, 667, 2, 750, 1334],   // iPhone SE 2/3, 6/7/8
  [414, 896, 2, 828, 1792],   // iPhone XR, 11
  [375, 812, 3, 1125, 2436],  // iPhone X, XS, 11 Pro
  [390, 844, 3, 1170, 2532],  // iPhone 12, 13, 14
  [393, 852, 3, 1179, 2556],  // iPhone 14 Pro, 15, 16
  [414, 736, 3, 1242, 2208],  // iPhone 6/7/8 Plus
  [414, 896, 3, 1242, 2688],  // iPhone XS Max, 11 Pro Max
  [428, 926, 3, 1284, 2778],  // iPhone 12/13 Pro Max, 14 Plus
  [430, 932, 3, 1290, 2796],  // iPhone 14/15 Pro Max, 16 Plus
];

/**
 * Metadatos que hacen INSTALABLE el panel, con la marca del estudio: al
 * "Agregar a pantalla de inicio" en iPhone/iPad el ícono, el nombre y la
 * pantalla de carga son los de ese estudio (iLoveMe ve su logo, no Tangible).
 */
export function studioPwaMetadata(brand: { slug: string; shortName: string }): Metadata {
  const assets = studioAssets(brand.slug);
  return {
    manifest: assets.manifest,
    applicationName: brand.shortName,
    icons: {
      icon: [
        { url: assets.favicon32, sizes: "32x32", type: "image/png" },
        { url: assets.favicon16, sizes: "16x16", type: "image/png" },
        { url: assets.icon192, sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: assets.appleTouchIcon, sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: brand.shortName,
      statusBarStyle: "default",
      startupImage: IOS_SCREENS.map(([cssW, cssH, ratio, pxW, pxH]) => ({
        url: assets.splash(pxW, pxH),
        media: `screen and (device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
      })),
    },
    other: {
      "apple-mobile-web-app-capable": "yes",
    },
  };
}

/** Panel de Tangible: lo que se usa cuando todavía no se sabe el estudio. */
export const adminPwaMetadata: Metadata = studioPwaMetadata({ slug: "tangible", shortName: "Tangible" });
