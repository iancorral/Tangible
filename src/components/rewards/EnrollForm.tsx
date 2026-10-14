"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SEEN_KEY } from "./StampCard";

const CODE_LENGTH = 6;

/** Lo que el QR del panel trae en ?code=, ya limpio. */
function cleanCode(raw: string | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, CODE_LENGTH);
}

/**
 * Six separate boxes rather than one masked field: it is what the owner is
 * reading out loud, one character at a time, and it makes a typo obvious.
 *
 * Con `initialCode` (llegó escaneando el QR del panel) se llena y se envía
 * sola: la clienta no escribe nada.
 */
export default function EnrollForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const fromQr = cleanCode(initialCode);
  const [chars, setChars] = useState<string[]>(() =>
    fromQr.length === CODE_LENGTH ? fromQr.split("") : Array(CODE_LENGTH).fill("")
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = chars.join("");

  const setChar = (index: number, value: string) => {
    // Accept a pasted code in any box, and ignore characters the alphabet
    // deliberately leaves out so a misread I or O does not become a dead end.
    let cleaned = value.toUpperCase().replace(/[^0-9A-Z]/g, "");

    // Typing into a box that already holds a character gives us "old"+"new".
    // Without this the old character would be kept and the new one pushed into
    // the next box, silently shifting the rest of the code — which produces a
    // wrong code that looks right on screen.
    if (cleaned.length === 2 && chars[index] && cleaned[0] === chars[index]) {
      cleaned = cleaned.slice(1);
    }

    if (!cleaned) {
      setChars((prev) => prev.map((c, i) => (i === index ? "" : c)));
      return;
    }

    setChars((prev) => {
      const next = [...prev];
      for (let i = 0; i < cleaned.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = cleaned[i];
      }
      return next;
    });

    const landing = Math.min(index + cleaned.length, CODE_LENGTH - 1);
    inputs.current[landing]?.focus();
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const activate = async (value: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo activar la tarjeta");
        setChars(Array(CODE_LENGTH).fill(""));
        inputs.current[0]?.focus();
        return;
      }

      // Sus sellos (por ejemplo el de la visita de hoy) caen la primera vez que
      // ve su tarjeta, en vez de aparecer ya puestos.
      try {
        window.localStorage.setItem(SEEN_KEY, "0");
      } catch {
        // Sin almacenamiento: la tarjeta se ve igual, solo sin animación.
      }

      // The pass is now set; the page reads the card server-side on refresh.
      // replace() además quita el código del enlace del QR (y del historial).
      router.replace("/rewards");
      router.refresh();
    } catch {
      setError("Sin conexión. Revisa tus datos e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length === CODE_LENGTH) activate(code);
  };

  // Llegó desde el QR: activar en cuanto se abre la página, una sola vez.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || fromQr.length !== CODE_LENGTH) return;
    autoSent.current = true;
    activate(fromQr);
    // activate es estable en la práctica; solo debe correr al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form onSubmit={submit}>
      <fieldset className="border-0 p-0 m-0">
        <legend className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-2">
          Código de activación
        </legend>

        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {chars.map((char, index) => (
            <input
              key={index}
              ref={(el) => {
                inputs.current[index] = el;
              }}
              value={char}
              onChange={(e) => setChar(index, e.target.value)}
              onKeyDown={(e) => onKeyDown(index, e)}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={CODE_LENGTH}
              aria-label={`Carácter ${index + 1} de ${CODE_LENGTH}`}
              className="aspect-[3/4] w-full text-center text-xl font-black text-salon-brown bg-white border-2 border-salon-olive/25 rounded-xl focus:outline-none focus:border-salon-brown transition-colors tabular-nums"
            />
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="text-[11px] text-salon-terracotta font-bold mb-3 leading-relaxed"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={code.length !== CODE_LENGTH || submitting}
          className="w-full py-4 bg-salon-brown text-salon-blush font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all disabled:bg-white disabled:text-salon-gray/60 disabled:border-2 disabled:border-salon-gray/20"
        >
          {submitting ? "Activando tu tarjeta…" : "Activar mi tarjeta"}
        </button>
      </fieldset>
    </form>
  );
}
