/**
 * El gatito de Tangible: un atigrado gris como el de la ilustración de la
 * marca (orejas rosas por dentro, hocico blanco, rayitas en la frente).
 *
 * Dibujado a mano en SVG, no recortado de la imagen: así queda nítido a
 * cualquier tamaño, pesa casi nada y se puede animar o cambiar de gesto.
 */

const FUR = "#A29D99";
const STRIPE = "#6F6964";
const LINE = "#3A2E26";
const EAR = "#F3C6D3";
const NOSE = "#E88FA9";
const MUZZLE = "#FFFDFB";

type Mood = "curious" | "happy";

function Eyes({ mood, cy }: { mood: Mood; cy: number }) {
  if (mood === "happy") {
    return (
      <g fill="none" stroke={LINE} strokeWidth="2.6" strokeLinecap="round">
        <path d={`M40 ${cy + 1} q5 -6 10 0`} />
        <path d={`M70 ${cy + 1} q5 -6 10 0`} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="45" cy={cy} rx="4.6" ry="5.4" fill={LINE} />
      <ellipse cx="75" cy={cy} rx="4.6" ry="5.4" fill={LINE} />
      <circle cx="46.6" cy={cy - 2} r="1.6" fill="#fff" />
      <circle cx="76.6" cy={cy - 2} r="1.6" fill="#fff" />
    </g>
  );
}

/** Cara completa: la usan el gatito que se asoma y el sello. */
function Face({ mood, whiskers = true }: { mood: Mood; whiskers?: boolean }) {
  return (
    <g strokeLinejoin="round">
      {/* Orejas */}
      <path d="M27 34 Q24 10 31 6 Q38 4 54 19 Z" fill={FUR} stroke={LINE} strokeWidth="2.4" />
      <path d="M93 34 Q96 10 89 6 Q82 4 66 19 Z" fill={FUR} stroke={LINE} strokeWidth="2.4" />
      <path d="M32 28 Q31 14 34 12 Q38 11 47 20 Z" fill={EAR} />
      <path d="M88 28 Q89 14 86 12 Q82 11 73 20 Z" fill={EAR} />

      {/* Cabeza */}
      <ellipse cx="60" cy="47" rx="38" ry="30" fill={FUR} stroke={LINE} strokeWidth="2.4" />

      {/* Rayitas de atigrado */}
      <g stroke={STRIPE} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M60 19 v9" />
        <path d="M51 21 l2.2 7.5" />
        <path d="M69 21 l-2.2 7.5" />
        <path d="M23.5 44 h7" />
        <path d="M24.5 51 h6" />
        <path d="M96.5 44 h-7" />
        <path d="M95.5 51 h-6" />
      </g>

      {/* Hocico blanco */}
      <path
        d="M60 52 C52 48 42 52 42 60 C42 68 52 72 60 69 C68 72 78 68 78 60 C78 52 68 48 60 52 Z"
        fill={MUZZLE}
      />

      {/* Chapitas */}
      <ellipse cx="34" cy="58" rx="5.5" ry="3.4" fill={EAR} opacity="0.85" />
      <ellipse cx="86" cy="58" rx="5.5" ry="3.4" fill={EAR} opacity="0.85" />

      <Eyes mood={mood} cy={44} />

      {/* Nariz y boquita */}
      <path d="M56 55.5 h8 q0 3 -4 5 q-4 -2 -4 -5 Z" fill={NOSE} stroke={LINE} strokeWidth="1.2" />
      <path
        d="M60 60.5 v1.8 q-2.6 3.4 -6 1.6 M60 62.3 q2.6 3.4 6 1.6"
        fill="none"
        stroke={LINE}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Bigotes */}
      {whiskers && (
        <g stroke={LINE} strokeWidth="1.3" strokeLinecap="round" opacity="0.55">
          <path d="M42 59 L17 55" />
          <path d="M42 63 L18 65" />
          <path d="M78 59 L103 55" />
          <path d="M78 63 L102 65" />
        </g>
      )}
    </g>
  );
}

/**
 * El gatito asomado por el borde del cupón: la cabeza arriba y las dos
 * patitas apoyadas en el filo. Se coloca con la parte baja del SVG
 * encimada ~12px sobre la tarjeta.
 */
export function CatPeek({ mood = "curious", className = "" }: { mood?: Mood; className?: string }) {
  return (
    <svg viewBox="0 0 120 92" className={className} aria-hidden="true">
      <Face mood={mood} />
      {/* Patitas */}
      <g stroke={LINE} strokeWidth="2.4" strokeLinejoin="round">
        <path d="M27 92 V82 Q27 72 39 72 Q51 72 51 82 V92" fill={FUR} />
        <path d="M69 92 V82 Q69 72 81 72 Q93 72 93 82 V92" fill={FUR} />
      </g>
      <g stroke={STRIPE} strokeWidth="1.6" strokeLinecap="round">
        <path d="M35.5 76 v4" />
        <path d="M42.5 76 v4" />
        <path d="M77.5 76 v4" />
        <path d="M84.5 76 v4" />
      </g>
    </svg>
  );
}

/** Sólo la cara, para el sello (a 40px no caben bigotes). */
export function CatFace({ mood = "curious", className = "" }: { mood?: Mood; className?: string }) {
  return (
    <svg viewBox="12 2 96 78" className={className} aria-hidden="true">
      <Face mood={mood} whiskers={false} />
    </svg>
  );
}

/** Huellita: marca dónde va el siguiente sello. */
export function PawPrint({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <ellipse cx="12" cy="16" rx="5" ry="4.2" />
      <ellipse cx="6" cy="10.5" rx="2" ry="2.5" />
      <ellipse cx="10" cy="7" rx="2" ry="2.6" />
      <ellipse cx="14" cy="7" rx="2" ry="2.6" />
      <ellipse cx="18" cy="10.5" rx="2" ry="2.5" />
    </svg>
  );
}

/** Regalito: el último espacio de la tarjeta es la recompensa. */
export function GiftMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M3 7.5h18V10H3z" />
      <path d="M12 7.5V20" />
      <path d="M12 7.5c-1.5-3.5-5.5-4-5.5-1.5S10 7.5 12 7.5Zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 7.5 12 7.5Z" />
    </svg>
  );
}
