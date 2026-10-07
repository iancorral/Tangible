import Image from "next/image";
import { studioAssets } from "@/lib/studio-brand";

interface Props {
  slug: string;
  name: string;
  /** Diámetro en px. */
  size?: number;
  className?: string;
}

/**
 * Logo del estudio en círculo, como una foto de perfil. Un mismo marco para
 * todos los estudios: la ilustración de Tangible y el lettering de iLoveMe se
 * ven parejos y "asentados", en lugar de flotar sueltos o en un recuadro.
 * next/image sirve una versión del tamaño justo (no el PNG original).
 */
export default function StudioMark({ slug, name, size = 44, className = "" }: Props) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-salon-brown/10 shadow-[0_2px_10px_-3px_rgba(44,31,14,0.25)] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src={studioAssets(slug).mark} alt={name} fill sizes={`${size * 2}px`} className="object-cover" />
    </span>
  );
}
