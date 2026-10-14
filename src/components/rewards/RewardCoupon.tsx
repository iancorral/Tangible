import StampCard from "./StampCard";
import { CatPeek } from "./CatMascot";

interface Props {
  stamps: number;
  required: number;
  rewardLabel: string;
  termsNote?: string | null;
  /** Vista previa en la pantalla de activación: sin animaciones ni conteo. */
  preview?: boolean;
}

/** Destellos del talón cuando la tarjeta está llena. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`absolute ${className}`} aria-hidden="true" fill="currentColor">
      <path d="M12 1.5c.7 5.6 2.9 7.8 8.5 8.5-5.6.7-7.8 2.9-8.5 8.5-.7-5.6-2.9-7.8-8.5-8.5 5.6-.7 7.8-2.9 8.5-8.5Z" />
    </svg>
  );
}

/** Radio de las muescas del boleto, en px. */
const NOTCH = 14;

/** Esquinas mordidas abajo (parte de sellos) o arriba (talón). */
function notched(edge: "bottom" | "top", color: string) {
  const y = edge === "bottom" ? "100%" : "0";
  const fill = `${color} ${NOTCH + 0.5}px`;
  return {
    background: [
      `radial-gradient(circle at 0 ${y}, transparent ${NOTCH}px, ${fill}) ${edge} left / 51% 100% no-repeat`,
      `radial-gradient(circle at 100% ${y}, transparent ${NOTCH}px, ${fill}) ${edge} right / 51% 100% no-repeat`,
    ].join(", "),
  };
}

/**
 * La tarjeta de sellos como cupón: un boleto con su talón desprendible y el
 * gatito de Tangible asomado por arriba. Arriba van los sellos; el talón dice
 * qué se gana y, al llenarse, se vuelve el cupón para canjear.
 */
export default function RewardCoupon({ stamps, required, rewardLabel, termsNote, preview = false }: Props) {
  const filled = Math.min(stamps, required);
  const complete = !preview && stamps >= required;
  const remaining = Math.max(required - stamps, 0);
  const stubColor = complete ? "#2C1F0E" : "#FDF0F4";

  return (
    <div className="relative pt-[58px] drop-shadow-[0_10px_18px_rgba(44,31,14,0.10)]">
      <CatPeek
        mood={complete ? "happy" : "curious"}
        className="absolute left-1/2 top-0 z-10 w-[118px] -translate-x-1/2 drop-shadow-[0_2px_0_rgba(44,31,14,0.06)]"
      />

      {/* Parte de los sellos */}
      <div className="relative rounded-t-[28px] px-5 pt-9 pb-6" style={notched("bottom", "#FFFFFF")}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <p className="text-[10px] font-black text-salon-terracotta uppercase tracking-[0.2em]">
            Tarjeta de sellos
          </p>
          {!preview && (
            <p className="text-xs font-black text-salon-brown tabular-nums">
              {filled} <span className="font-normal text-salon-gray">/ {required}</span>
            </p>
          )}
        </div>

        <StampCard stamps={preview ? 0 : stamps} required={required} track={!preview} />

        {!preview && (
          <p className="mt-5 text-center text-xs text-salon-brown leading-relaxed">
            {complete ? (
              <strong>¡Llenaste tu tarjeta!</strong>
            ) : remaining === 1 ? (
              <>
                ¡Ya casi! Falta <strong>1 visita</strong>
              </>
            ) : (
              <>
                Faltan <strong>{remaining} visitas</strong> para tu recompensa
              </>
            )}
          </p>
        )}
      </div>

      {/* Talón */}
      <div className="relative rounded-b-[28px] px-9 pt-6 pb-6 text-center" style={notched("top", stubColor)}>
        {complete && (
          <>
            <Sparkle className="left-5 top-6 h-4 w-4 text-salon-blush/80" />
            <Sparkle className="left-4 bottom-7 h-2.5 w-2.5 text-salon-pink" />
            <Sparkle className="right-5 top-9 h-3 w-3 text-salon-pink" />
            <Sparkle className="right-4 bottom-6 h-4 w-4 text-salon-blush/70" />
          </>
        )}

        {/* Línea para desprender */}
        <div
          aria-hidden="true"
          className={`absolute top-0 left-[22px] right-[22px] border-t-2 border-dashed ${
            complete ? "border-white/25" : "border-salon-pink/45"
          }`}
        />

        <p
          className={`relative text-[10px] font-black uppercase tracking-[0.2em] ${
            complete ? "text-salon-blush" : "text-salon-pink"
          }`}
        >
          {complete ? "Recompensa lista" : `Tu recompensa al llegar a ${required}`}
        </p>
        <p
          className={`font-title mt-1.5 text-[22px] font-black uppercase leading-tight tracking-[0.06em] ${
            complete ? "text-white" : "text-salon-brown"
          }`}
        >
          {rewardLabel}
        </p>
        {complete ? (
          <p className="mt-2 text-[11px] leading-relaxed text-white/75">
            Muestra esta pantalla al pagar y te la aplicamos.
          </p>
        ) : (
          termsNote && <p className="mt-2 text-[11px] leading-relaxed text-salon-gray">{termsNote}</p>
        )}
      </div>
    </div>
  );
}
