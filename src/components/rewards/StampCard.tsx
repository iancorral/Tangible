"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

/**
 * Cat face. Deliberately geometric: at 40px the silhouette is the whole design,
 * so it is two ears and a head, with the eyes and nose only drawn on the filled
 * state where there is enough contrast to carry them.
 */
function CatMark({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[64%] h-[64%]" aria-hidden="true">
      <g
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M5.2 8.6 L3.7 2.5 L9.4 5.7 Z" />
        <path d="M18.8 8.6 L20.3 2.5 L14.6 5.7 Z" />
        <ellipse cx="12" cy="13.2" rx="7.5" ry="6.6" />
      </g>

      {filled && (
        <>
          {/* Drawn in the card's own brown, so they read as cut-outs. */}
          <circle cx="9.1" cy="12.4" r="0.95" fill="#2C1F0E" />
          <circle cx="14.9" cy="12.4" r="0.95" fill="#2C1F0E" />
          {/* Heart nose keeps the terracotta accent the flower used to carry. */}
          <path
            d="M12 16.4c-1.5-1-2.3-1.7-2.3-2.5a1.15 1.15 0 0 1 2.3-.45 1.15 1.15 0 0 1 2.3.45c0 .8-.8 1.5-2.3 2.5Z"
            fill="#C4522A"
          />
        </>
      )}
    </svg>
  );
}

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
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${required}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${filled} de ${required} sellos`}
      >
        {Array.from({ length: required }, (_, i) => {
          const isFilled = i < filled;
          const isNext = i === filled;
          // Only the stamps that arrived since her last look pop in.
          const isNew = earned > 0 && i >= filled - earned && isFilled;

          return (
            <div
              key={i}
              aria-hidden="true"
              className={`aspect-square rounded-full grid place-items-center border-2 ${
                isFilled
                  ? "bg-salon-brown border-salon-brown text-salon-blush"
                  : isNext
                    ? "border-dashed border-salon-terracotta text-salon-terracotta/60"
                    : "border-dashed border-salon-olive/35 text-salon-olive/30"
              } ${isNew ? "stamp-pop" : ""}`}
            >
              <CatMark filled={isFilled} />
            </div>
          );
        })}
      </div>
    </>
  );
}
