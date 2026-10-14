"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

/** Página pública de la tarjeta (www), no el panel. */
const PUBLIC_SITE = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const POLL_MS = 3000;

interface Props {
  customerId: string;
  customerName: string;
  onClose: () => void;
  /** Avisa al que abrió el diálogo para refrescar su estado ("Activada"). */
  onActivated?: () => void;
}

type Issued = { code: string; expiresAt: string; issuedAt: number };

function formatCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/**
 * Activar la tarjeta de sellos de una clienta.
 *
 * Lo principal es el QR: ella lo escanea con la cámara y su tarjeta queda
 * activa, sin dictar ni escribir nada. El código de 6 caracteres sigue debajo
 * como respaldo (sticker NFC + escribirlo). Mientras está abierto, el diálogo
 * pregunta cada pocos segundos si ya se activó y lo celebra.
 *
 * El código nunca se guarda en texto: si se cierra, "Generar otro" emite uno
 * nuevo y el anterior deja de servir.
 */
export default function ActivateCardDialog({ customerId, customerName, onClose, onActivated }: Props) {
  useBodyScrollLock();
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activated, setActivated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const issuedRef = useRef<Issued | null>(null);
  // En ref: quien abre el diálogo suele pasar una función nueva en cada render,
  // y eso no debe reiniciar la consulta.
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const issue = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rewards/claim-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data: { code?: string; expiresAt?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.code || !data.expiresAt) {
        setError(data.error ?? "No se pudo generar el código. Intenta de nuevo.");
        return;
      }
      const next = { code: data.code, expiresAt: data.expiresAt, issuedAt: Date.now() };
      issuedRef.current = next;
      setIssued(next);
    } catch {
      setError("No hay conexión. Revisa tu internet y vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }, [customerId]);

  // Un código nuevo al abrir.
  useEffect(() => {
    issue();
  }, [issue]);

  // Cuenta regresiva.
  useEffect(() => {
    if (!issued || activated) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [issued, activated]);

  // ¿Ya lo escaneó? Se detiene al activarse o al cerrar el diálogo.
  useEffect(() => {
    if (!issued || activated) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/admin/rewards/claim-code?customerId=${customerId}`);
        if (!res.ok) return;
        const data: { lastActivatedAt: string | null } = await res.json();
        const current = issuedRef.current;
        if (current && data.lastActivatedAt && new Date(data.lastActivatedAt).getTime() >= current.issuedAt - 5000) {
          stopped = true;
          setActivated(true);
          onActivatedRef.current?.();
        }
      } catch {
        // Sin conexión un momento: se vuelve a preguntar en el siguiente ciclo.
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [issued, activated, customerId]);

  useEffect(() => {
    // En captura y sin propagar: Escape cierra solo este, no el cobro de atrás.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const remainingMs = issued ? new Date(issued.expiresAt).getTime() - now : 0;
  const expired = issued !== null && remainingMs <= 0;
  const mm = Math.max(0, Math.floor(remainingMs / 60000));
  const ss = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  const site = PUBLIC_SITE || (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = issued ? `${site}/rewards?code=${issued.code}` : "";
  const firstName = customerName.trim().split(/\s+/)[0];

  // Portal: se abre también desde dentro del cobro, que es otro modal.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Activar la tarjeta de ${customerName}`}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-t-[28px] bg-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-salon-gray hover:bg-salon-brown/5">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {activated ? (
          <div className="py-6 text-center">
            <div className="stamp-pop mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-salon-olive text-white shadow-lg">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-black text-salon-brown">¡Tarjeta activada!</p>
            <p className="mt-1 text-sm text-salon-gray">
              {firstName} ya puede ver sus sellos en su celular. En cada cita, al acercar su celular al sticker, le cae su sello.
            </p>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-salon-brown py-3.5 text-[11px] font-black uppercase tracking-widest text-white">
              Listo
            </button>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-salon-terracotta">Tarjeta de sellos</p>
            <h2 className="mt-1 pr-10 text-lg font-black leading-snug text-salon-brown">Activar la tarjeta de {firstName}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-salon-gray">
              Que lo escanee con la cámara de su celular.
            </p>

            <div className="relative mx-auto mt-5 aspect-square w-full max-w-[240px] rounded-3xl border-2 border-salon-brown/10 bg-white p-4">
              {issued && !expired ? (
                <QRCode value={qrValue} size={256} fgColor="#2C1F0E" bgColor="#FFFFFF" style={{ width: "100%", height: "100%" }} />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs font-bold text-salon-gray">
                  {busy ? "Generando…" : expired ? "Este código venció" : error ? "" : "Generando…"}
                </div>
              )}
            </div>

            {issued && !expired && (
              <div className="mt-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-salon-gray">o en el sticker, este código</p>
                <p className="mt-1 text-3xl font-black tracking-[0.18em] text-salon-brown tabular-nums">{formatCode(issued.code)}</p>
                <p className="mt-1 text-[11px] text-salon-gray tabular-nums">
                  Un solo uso · vence en {mm}:{String(ss).padStart(2, "0")}
                </p>
                <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-bold text-salon-olive">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-salon-olive/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-salon-olive" />
                  </span>
                  Esperando que lo escanee…
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={issue}
              disabled={busy}
              className="mt-5 w-full rounded-2xl border-2 border-salon-brown/15 py-3 text-[11px] font-black uppercase tracking-widest text-salon-brown transition-colors hover:bg-salon-brown/5 disabled:opacity-50"
            >
              {expired ? "Generar código nuevo" : "Generar otro código"}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
