"use client";

import QRCodeSVG from "react-qr-code";
import { useRef, useState } from "react";
import MuralDecorations from '@/components/layout/MuralDecorations';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// URLs que se graban en los stickers NFC. Apuntan a Tangible, no a Google ni a
// nada externo: así el destino se puede cambiar sin volver a grabar el sticker.
// Nunca llevan datos de ninguna clienta: un sticker en el mostrador lo lee
// cualquiera que pase.
const REVIEW_TAG_URL = `${APP_URL}/review`;
const REWARDS_TAG_URL = `${APP_URL}/rewards`;

export default function QRPage() {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const copyTagUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Clipboard bloqueado (contexto no seguro): la URL está visible y se
      // puede seleccionar a mano, así que no hace falta molestar con un error.
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 400;
    canvas.height = 400;

    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = "#FDFCF8";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement("a");
      link.download = "tangible-qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

    return (
      <main className="min-h-screen p-6 md:p-10 bg-salon-bg relative">
        <MuralDecorations />
        <div className="max-w-sm mx-auto relative z-10">

        <header className="mb-8">
          <a href="/admin" className="text-xs text-salon-gray font-bold uppercase tracking-wider hover:text-salon-brown mb-4 block">
            ← Volver al panel
          </a>
          <h1 className="font-title text-2xl sm:text-3xl font-black text-salon-brown uppercase tracking-[0.15em] mb-1">
            QR Code
          </h1>
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-8 bg-salon-terracotta"></div>
            <p className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              Para imprimir en el local
            </p>
          </div>
        </header>

        {/* QR Card */}
        <div className="bg-white rounded-2xl border-2 border-salon-olive/20 shadow-folk p-8 hand-drawn text-center mb-6">
          
          <p className="text-xs font-black text-salon-gray uppercase tracking-widest mb-6">
            Escanea para agendar
          </p>

          <div ref={qrRef} className="flex justify-center mb-6">
            <div className="p-4 bg-white rounded-xl border-2 border-salon-olive/20">
              <QRCodeSVG
                value={APP_URL}
                size={200}
                fgColor="#3E311D"
                bgColor="#FDFCF8"
                level="H"
              />
            </div>
          </div>

          <h2 className="font-title text-2xl font-black text-salon-brown tracking-[0.2em] uppercase mb-1">
            TANGIBLE
          </h2>
          <p className="text-[10px] text-salon-terracotta font-bold uppercase tracking-widest">
            Nails & Art Studio
          </p>
        </div>

        {/* Instrucciones */}
        <div className="bg-salon-honey/20 border-2 border-salon-honey rounded-2xl p-5 hand-drawn mb-6">
          <p className="text-xs font-black text-salon-brown uppercase tracking-wider mb-3">
            Cómo usarlo
          </p>
          <div className="space-y-2 text-xs text-salon-gray">
            <p>1. Descarga la imagen con el botón de abajo</p>
            <p>2. Imprímela en tamaño carta o media carta</p>
            <p>3. Colócala en el mostrador, espejo o mesa</p>
            <p>4. Las clientas escanean y agendan directo</p>
          </div>
        </div>

        <button
          onClick={downloadQR}
          className="w-full py-4 bg-salon-brown text-salon-honey font-black text-xs uppercase tracking-widest rounded-xl hand-drawn border-2 border-salon-brown hover:bg-salon-brown/90 transition-all shadow-folk"
        >
          Descargar QR
        </button>

        {/* STICKER NFC — Reseñas de Google */}
        <section className="mt-10">
          <div className="flex items-center gap-3 opacity-70 mb-3">
            <div className="h-[2px] w-8 bg-salon-terracotta"></div>
            <h2 className="text-xs text-salon-terracotta font-bold tracking-widest uppercase">
              Sticker NFC
            </h2>
          </div>

          <div className="bg-white rounded-2xl border-2 border-salon-lavender/30 shadow-sm p-6 mb-4">
            <p className="text-[10px] font-black text-salon-lavender uppercase tracking-widest mb-1">
              Sticker 1
            </p>
            <p className="text-sm font-black text-salon-brown uppercase tracking-wide mb-1">
              Reseñas de Google
            </p>
            <p className="text-xs text-salon-gray mb-5 leading-relaxed">
              La clienta acerca su teléfono al sticker y se abre directo la ventana para
              dejar la reseña.
            </p>

            <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-2">
              URL a grabar en el sticker
            </p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 min-w-0 truncate bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-xs text-salon-brown font-bold">
                {REVIEW_TAG_URL}
              </code>
              <button
                onClick={() => copyTagUrl(REVIEW_TAG_URL)}
                className="shrink-0 px-4 py-2.5 bg-salon-brown text-salon-honey rounded-xl text-[10px] font-black uppercase tracking-wider transition-transform hover:scale-[1.03] active:scale-[0.97]"
              >
                {copiedUrl === REVIEW_TAG_URL ? "Copiado" : "Copiar"}
              </button>
            </div>

            <a
              href="/review"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 border-2 border-salon-olive/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-salon-olive hover:bg-salon-olive/5 transition-all"
            >
              Probar el enlace →
            </a>
          </div>

          {/* Sticker 2 — tarjeta de recompensas */}
          <div className="bg-white rounded-2xl border-2 border-salon-honey/60 shadow-sm p-6">
            <p className="text-[10px] font-black text-salon-terracotta uppercase tracking-widest mb-1">
              Sticker 2
            </p>
            <p className="text-sm font-black text-salon-brown uppercase tracking-wide mb-1">
              Tarjeta de sellos
            </p>
            <p className="text-xs text-salon-gray mb-5 leading-relaxed">
              Abre su tarjeta de recompensas. El sticker no guarda ningún dato de la
              clienta: solo abre la página, y ahí se identifica su propio teléfono.
            </p>

            <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-2">
              URL a grabar en el sticker
            </p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 min-w-0 truncate bg-salon-bg border-2 border-salon-olive/20 rounded-xl px-3 py-2.5 text-xs text-salon-brown font-bold">
                {REWARDS_TAG_URL}
              </code>
              <button
                onClick={() => copyTagUrl(REWARDS_TAG_URL)}
                className="shrink-0 px-4 py-2.5 bg-salon-brown text-salon-honey rounded-xl text-[10px] font-black uppercase tracking-wider transition-transform hover:scale-[1.03] active:scale-[0.97]"
              >
                {copiedUrl === REWARDS_TAG_URL ? "Copiado" : "Copiar"}
              </button>
            </div>

            <a
              href="/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 border-2 border-salon-olive/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-salon-olive hover:bg-salon-olive/5 transition-all"
            >
              Probar el enlace →
            </a>
          </div>

          {/* Instrucciones comunes a los dos stickers */}
          <div className="bg-white rounded-2xl border-2 border-salon-olive/20 shadow-sm p-6 mt-4">
            <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-2">
              Cómo grabarlo
            </p>
            <div className="space-y-2 text-xs text-salon-gray leading-relaxed">
              <p>1. Instala la app <span className="font-bold text-salon-brown">NFC Tools</span> (gratis, iPhone y Android)</p>
              <p>2. Escribir → Añadir un registro → <span className="font-bold text-salon-brown">URL</span> → pega la URL del sticker que estés grabando</p>
              <p>3. Acerca el sticker al teléfono y mantenlo quieto hasta que confirme</p>
              <p>4. Pruébalo con un iPhone y con un Android antes de pegarlo</p>
              <p>5. Protégelo con contraseña (Otros → Definir contraseña). <span className="font-bold text-salon-terracotta">No uses el bloqueo permanente</span>: no tiene vuelta atrás</p>
            </div>

            <div className="mt-5 pt-5 border-t border-salon-gray/15 space-y-2 text-xs text-salon-gray leading-relaxed">
              <p>
                <span className="font-bold text-salon-brown">Stickers:</span> NTAG215 de 25–30 mm,
                en PET o epoxi (aguantan acetona y lavado). Compra al menos 6.
              </p>
              <p>
                <span className="font-bold text-salon-terracotta">Sobre metal o espejo</span> un
                sticker normal no funciona: necesitas stickers &quot;on-metal&quot;.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}