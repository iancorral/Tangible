// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

// Tipografía: la base (Century Gothic) se aplica a toda la interfaz vía
// fontFamily.sans en tailwind.config.js; la marca y los títulos principales de
// página (H1) usan .font-title (Boston Angel), pero NO los sub-encabezados de
// sección. Ambas se declaran como @font-face autohospedadas en globals.css.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// NOTA PWA: aquí solo van metadatos GLOBALES (título, favicons, color de tema).
// Los metadatos que hacen INSTALABLE la app (manifest + tags de Apple + splash)
// viven en `@/lib/pwa-metadata` y se aplican únicamente en los layouts de /login
// y /admin, para que la app instalable sea exclusiva del panel y las clientas de
// la web pública nunca vean el aviso de "instalar app".
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: "Tangible",
  title: {
    default: "Tangible | Nails & Art Studio",
    template: "%s | Tangible",
  },
  description: "Reserva tu experiencia de uñas y diseño en Tangible.",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  // El usuario puede hacer zoom (accesibilidad); no lo bloqueamos.
  maximumScale: 5,
  // Permite usar env(safe-area-inset-*) para no quedar bajo la barra de
  // inicio del iPhone (ver .pb-safe en globals.css).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
