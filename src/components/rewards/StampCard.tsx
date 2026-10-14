"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CatFace, GiftMark, PawPrint } from "./CatMascot";

/** Where the phone remembers how many stamps it last showed her. */
const SEEN_KEY = "tangible.stamps.seen";

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
   * The enrollment screen shows an empty card as decoration. It must not record
   * "she has seen 0 stamps", or activating would then celebrate her whole
   * existing balance as if it had just arrived.
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
  const [earned, setEarned] = useState(0);
  // Hasta 6 en una fila; más, en dos filas parejas.
  const columns = required <= 6 ? required : Math.ceil(required / 2);

  useEffect(() => {
    if (!track) return;

    const raw = window.localStorage.getItem(SEEN_KEY);
    window.localStorage.setItem(SEEN_KEY, String(filled));

    // No previous reading means this phone has never shown the card, so there is
    // nothing to have "just arrived". Note the null check has to come first:
    // Number(null) is 0, which would read as a balance of zero and celebrate
    // every stamp she already had.
    if (raw === null) return;

    // A redemption sends the count down. Celebrate only a genuine increase.
    const previous = Number(raw);
    if (!Number.isFinite(previous) || filled <= previous) return;

    // Deferred to the next frame on purpose: an entrance animation started
    // during hydration is usually swallowed before it can paint.
    const frame = requestAnimationFrame(() => setEarned(filled - previous));
    return () => cancelAnimationFrame(frame);
  }, [filled, track]);

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
    <>
      {earned > 0 && (
        <p
          role="status"
          className="stamp-cheer text-center text-[11px] font-black uppercase tracking-widest text-salon-terracotta mb-3"
        >
          {earned === 1 ? "¡Se sumó tu sello!" : `¡Se sumaron ${earned} sellos!`}
        </p>
      )}

      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${filled} de ${required} sellos`}
      >
        {Array.from({ length: required }, (_, i) => {
          const isFilled = i < filled;
          const isNext = i === filled;
          const isReward = i === required - 1;
          // Only the stamps that arrived since her last look pop in.
          const isNew = earned > 0 && i >= filled - earned && isFilled;

          return (
            <div key={i} aria-hidden="true" className="relative aspect-square">
              {isFilled ? (
                <div
                  className={`absolute inset-0 rounded-full grid place-items-center bg-salon-blush ring-2 ring-salon-pink/60 ring-offset-2 ring-offset-white shadow-[inset_0_-3px_0_rgba(196,120,154,0.25)] ${
                    isNew ? "stamp-pop" : ""
                  }`}
                  style={{ transform: isNew ? undefined : `rotate(${TILT[i % TILT.length]}deg)` }}
                >
                  <CatFace mood={filled === required ? "happy" : "curious"} className="w-[78%] h-[78%] translate-y-[3%]" />
                </div>
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
    </>
  );
}
