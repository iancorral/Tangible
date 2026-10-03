"use client";

import { usePrivacy } from "./PrivacyProvider";

interface Props {
  className?: string;
}

export default function PrivacyToggle({ className = "" }: Props) {
  const { hidden, toggle } = usePrivacy();
  const label = hidden ? "Mostrar montos" : "Ocultar montos";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 shadow-sm shrink-0 transition-all hover:scale-105 active:scale-95 ${
        hidden
          ? "bg-salon-brown border-salon-brown text-salon-blush"
          : "bg-white border-salon-olive/20 text-salon-gray hover:text-salon-olive hover:border-salon-olive/40"
      } ${className}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        {hidden ? (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </>
        ) : (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
    </button>
  );
}
