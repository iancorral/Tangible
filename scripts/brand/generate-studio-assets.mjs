// scripts/brand/generate-studio-assets.mjs
//
// Genera todo lo visual de un estudio a partir de su logo:
//
//   node scripts/brand/generate-studio-assets.mjs <slug> <logo>
//   node scripts/brand/generate-studio-assets.mjs iloveme assets/brands/iloveme/logo-source.jpg
//
// Escribe en public/studios/<slug>/:
//   logo.png               logo de un solo color con fondo transparente (panel)
//   apple-touch-icon.png   180×180, ícono al agregarlo a la pantalla de inicio en iPhone/iPad
//   icon-192.png / icon-512.png             ícono de la app (Android/escritorio)
//   icon-maskable-192.png / -512.png        con margen para los recortes de Android
//   favicon-16.png / favicon-32.png         pestaña del navegador
//   splash-<w>x<h>.png      pantallas de carga de iOS (mismas medidas que Tangible)
//
// Pensado para logos de un solo color sobre fondo claro (como iLoveMe): el
// fondo se vuelve transparente según qué tan claro es cada pixel.

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [slug, source] = process.argv.slice(2);
if (!slug || !source || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Uso: node scripts/brand/generate-studio-assets.mjs <slug> <logo>");
  process.exit(1);
}

const OUT = join("public", "studios", slug);
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CREAM = { r: 0xfa, g: 0xf7, b: 0xf2, alpha: 1 }; // fondo del panel (salon-bg)

// Mismas pantallas que public/splash de Tangible (ver lib/pwa-metadata.ts).
const SPLASHES = [
  [640, 1136], [750, 1334], [828, 1792], [1125, 2436], [1170, 2532],
  [1179, 2556], [1242, 2208], [1242, 2688], [1284, 2778], [1290, 2796],
];

mkdirSync(OUT, { recursive: true });

/** Logo con fondo transparente y recortado a su contenido. */
async function transparentLogo() {
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;

  // Color de la tinta: promedio de los pixeles claramente oscuros.
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < px; i++) {
    const [R, G, B] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    if ((R + G + B) / 3 < 128) { r += R; g += G; b += B; n++; }
  }
  const ink = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  const inkGray = (ink[0] + ink[1] + ink[2]) / 3;

  // Alfa según qué tan lejos está cada pixel del blanco (bordes suaves intactos).
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const gray = (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3;
    const alpha = Math.max(0, Math.min(255, Math.round(((255 - gray) / (255 - inkGray)) * 255)));
    out[i * 4] = ink[0]; out[i * 4 + 1] = ink[1]; out[i * 4 + 2] = ink[2]; out[i * 4 + 3] = alpha;
  }

  const trimmed = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
  console.log(`tinta detectada: rgb(${ink.join(", ")})`);
  return trimmed;
}

/** Cuadro de `size` con el logo ocupando `fill` (0–1) del lado, sobre `bg`. */
async function square(logo, size, fill, bg) {
  const inner = Math.round(size * fill);
  const resized = await sharp(logo).resize(inner, inner, { fit: "inside" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: resized, gravity: "center" }])
    .png();
}

const logo = await transparentLogo();
await sharp(logo).resize({ width: 800, withoutEnlargement: true }).png().toFile(join(OUT, "logo.png"));

await (await square(logo, 180, 0.8, WHITE)).toFile(join(OUT, "apple-touch-icon.png"));
await (await square(logo, 192, 0.8, WHITE)).toFile(join(OUT, "icon-192.png"));
await (await square(logo, 512, 0.8, WHITE)).toFile(join(OUT, "icon-512.png"));
// Zona segura de Android: el 80% central del círculo; el logo va al 62%.
await (await square(logo, 192, 0.62, WHITE)).toFile(join(OUT, "icon-maskable-192.png"));
await (await square(logo, 512, 0.62, WHITE)).toFile(join(OUT, "icon-maskable-512.png"));
await (await square(logo, 32, 0.92, WHITE)).toFile(join(OUT, "favicon-32.png"));
await (await square(logo, 16, 0.95, WHITE)).toFile(join(OUT, "favicon-16.png"));

for (const [w, h] of SPLASHES) {
  const width = Math.round(w * 0.5);
  const resized = await sharp(logo).resize({ width }).toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: CREAM } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(join(OUT, `splash-${w}x${h}.png`));
}

console.log(`Listo: ${OUT}`);
