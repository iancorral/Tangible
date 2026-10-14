"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CatFace, GiftMark, PawPrint } from "./CatMascot";

/** Where the phone remembers how many stamps it last showed her. */
export const SEEN_KEY = "tangible.stamps.seen";

/**
 * Cuánto se ve la tarjeta "como estaba" antes de que caiga el sello nuevo, y
 * cuánto espera cada sello extra. Es el momento del NFC: acerca el celular, se
 * abre su tarjeta y el sello cae frente a ella.
 */
const LAND_DELAY_MS = 700;
const STAGGER_MS = 220;
/** Dentro de la animación stamp-drop, cuándo toca la tarjeta (55% de 640ms). */
const TOUCHDOWN_MS = 350;

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(value: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(value));
  } catch {
    // Modo privado o almacenamiento bloqueado: sin animación, la tarjeta igual sirve.
  }
}

/**
 * How the open card notices a stamp granted while she is looking at it.
 *
 * Bounded on purpose: this exists for the minute around checkout, not to keep a
 * forgotten tab polling all afternoon. It also pauses whenever the tab is not
 * visible, which on a phone is most of the time.
 */
const POLL_MS = 5000;
const POLL_LIMIT = 42; // ~3.5 minutes of visible time

interface Props {
  stamps: number;
  required: number;
  /**
   * The enrollment screen shows an empty card as decoration, so it does not
   * track. Activating is what records "0 seen" (EnrollForm), on purpose.
   */
  track?: boolean;
}

/** Un poco chueco, como un sello de verdad; fijo por posición para no brincar. */
const TILT = [-8, 5, -3, 7, -6, 4, -5, 8, -4, 6];

/**
 * The stamp card, client-side so it can notice a stamp that landed since she
 * last looked and make a moment of it.
 *
 * The comparison lives in localStorage on her own phone. Nothing is sent
 * anywhere and nothing new is trusted: the count still comes from the server,
 * and this only decides whether to animate it.
 */
export default function StampCard({ stamps, required, track = true }: Props) {
  const router = useRouter();
  const filled = Math.min(stamps, required);
  // `pending`: sellos nuevos que todavía no "caen" (se dibujan vacíos).
  // `earned`: los que acaban de caer, para animarlos y dar el aviso.
  const [pending, setPending] = useState(0);
  const [earned, setEarned] = useState(0);
  const [fromZero, setFromZero] = useState(false);
  // Hasta 6 en una fila; más, en dos filas parejas.
  const columns = required <= 6 ? required : Math.ceil(required / 2);

  // Layout effect: decide antes de pintar que los sellos nuevos empiecen
  // vacíos, para que no se vean un instante ya puestos y luego desaparezcan.
  useLayoutEffect(() => {
    if (!track) return;

    const raw = readSeen();
    writeSeen(filled);

    // No previous reading means this phone has never shown the card, so there is
    // nothing to have "just arrived". Note the null check has to come first:
    // Number(null) is 0, which would read as a balance of zero and celebrate
    // every stamp she already had. (Al activar, EnrollForm deja un 0 a
    // propósito: sus sellos caen la primera vez que ve su tarjeta.)
    if (raw === null) return;

    // A redemption sends the count down. Celebrate only a genuine increase.
    const previous = Number(raw);
    if (!Number.isFinite(previous) || filled <= previous) return;

    const count = filled - previous;
    setPending(count);
    setFromZero(previous === 0);
    const timer = setTimeout(() => {
      setPending(0);
      setEarned(count);
    }, LAND_DELAY_MS);
    // Un golpecito cuando cada sello toca la tarjeta (Android; iPhone lo ignora).
    const buzz = setTimeout(() => {
      try {
        navigator.vibrate?.(Array.from({ length: count * 2 - 1 }, (_, k) => (k % 2 === 0 ? 24 : STAGGER_MS - 24)));
      } catch {
        // Sin vibración no pasa nada.
      }
    }, LAND_DELAY_MS + TOUCHDOWN_MS);
    return () => {
      clearTimeout(timer);
      clearTimeout(buzz);
    };
  }, [filled, track]);

  // Abrir la tarjeta (el toque del NFC) cobra el sello de la cita de hoy, si
  // le toca. Una vez por apertura; el servidor decide y nunca da dos por cita.
  // Si llega uno, se vuelve a pintar la tarjeta y el sello cae.
  const tapped = useRef(false);
  useEffect(() => {
    if (!track || tapped.current) return;
    tapped.current = true;
    fetch("/api/rewards/tap", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.granted) router.refresh();
      })
      .catch(() => {
        // Sin conexión: el sello no se pierde, se suma al registrar el pago.
      });
  }, [track, router]);

  // Watch for a stamp arriving while the card is open. Rather than patching the
  // count in place — which would leave the progress bar, the "faltan N visitas"
  // line and the gold complete state disagreeing with the grid — ask the server
  // component to re-render. The effect above then sees the new number and
  // celebrates it exactly as it would on a fresh tap.
  useEffect(() => {
    if (!track) return;

    let polls = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (stopped || polls >= POLL_LIMIT) return;
      timer = setTimeout(run, POLL_MS);
    };

    const run = async () => {
      if (stopped) return;

      if (document.visibilityState !== "visible") {
        schedule();
        return;
      }

      polls++;
      try {
        const res = await fetch("/api/rewards/card");
        if (!res.ok) {
          stopped = true;
          return;
        }
        const data = await res.json();
        if (typeof data.stamps === "number" && data.stamps !== stamps) {
          stopped = true;
          router.refresh();
          return;
        }
      } catch {
        // Offline or a dropped request. Keep waiting; her card is not wrong,
        // just not fresh, and the next tap will load it anyway.
      }
      schedule();
    };

    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [stamps, track, router]);

  return (
    <div className="relative">
      {/* Flota sobre la línea de "faltan N visitas" y se va sola: no empuja la tarjeta. */}
      {earned > 0 && (
        <div
          className="stamp-toast absolute inset-x-0 top-full z-10 mt-3 flex justify-center bg-white py-1"
          style={{ animationDelay: `350ms, ${3200 + (earned - 1) * STAGGER_MS}ms` }}
        >
          <p
            role="status"
            className="whitespace-nowrap rounded-full bg-salon-terracotta px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-md"
          >
            {earned === 1
              ? "¡Se sumó tu sello!"
              : fromZero
                ? `¡Aquí están tus ${earned} sellos!`
                : `¡Se sumaron ${earned} sellos!`}
          </p>
        </div>
      )}

      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${filled} de ${required} sellos`}
      >
        {Array.from({ length: required }, (_, i) => {
          // Mientras caen, los nuevos se ven vacíos y el primero como "siguiente".
          const shown = filled - pending;
          const isFilled = i < shown;
          const isNext = i === shown;
          const isReward = i === required - 1;
          // Only the stamps that arrived since her last look drop in.
          const order = i - (filled - earned);
          const isNew = earned > 0 && order >= 0 && isFilled;
          const tilt = `${TILT[i % TILT.length]}deg`;
          const delay = isNew ? `${order * STAGGER_MS}ms` : undefined;

          return (
            <div key={i} aria-hidden="true" className="relative aspect-square">
              {isFilled ? (
                <>
                  {isNew && (
                    <span
                      className="stamp-ripple absolute inset-0 rounded-full border-2 border-salon-pink"
                      style={{ animationDelay: delay }}
                    />
                  )}
                  <div
                    className={`absolute inset-0 rounded-full grid place-items-center bg-salon-blush ring-2 ring-salon-pink/60 ring-offset-2 ring-offset-white shadow-[inset_0_-3px_0_rgba(196,120,154,0.25)] ${
                      isNew ? "stamp-drop" : ""
                    }`}
                    style={{ "--tilt": tilt, transform: `rotate(${tilt})`, animationDelay: delay } as React.CSSProperties}
                  >
                    <CatFace mood={filled === required ? "happy" : "curious"} className="w-[78%] h-[78%] translate-y-[3%]" />
                  </div>
                </>
              ) : (
                <div
                  className={`absolute inset-0 rounded-full grid place-items-center border-2 border-dashed ${
                    isNext
                      ? "border-salon-terracotta/70 bg-salon-terracotta/[0.04] text-salon-terracotta/55"
                      : "border-salon-brown/15 text-salon-brown/15"
                  }`}
                >
                  {isReward ? (
                    <GiftMark className={`w-[48%] h-[48%] ${isNext ? "" : "text-salon-pink/70"}`} />
                  ) : (
                    <PawPrint className="w-[44%] h-[44%]" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
