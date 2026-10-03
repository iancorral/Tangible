"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CODE_LENGTH = 6;

/**
 * Six separate boxes rather than one masked field: it is what the owner is
 * reading out loud, one character at a time, and it makes a typo obvious.
 */
export default function EnrollForm() {
  const router = useRouter();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo activar la tarjeta");
        setChars(Array(CODE_LENGTH).fill(""));
        inputs.current[0]?.focus();
        return;
      }

      // The pass is now set; the page reads the card server-side on refresh.
      router.refresh();
    } catch {
      setError("Sin conexión. Revisa tus datos e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

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
          {submitting ? "Activando..." : "Activar mi tarjeta"}
        </button>
      </fieldset>
    </form>
  );
}
