import { useEffect } from "react";

/**
 * Bloquea el scroll de la página mientras un modal está abierto.
 *
 * En iOS Safari `overflow: hidden` en <body> no basta: el dedo sigue moviendo
 * la página de atrás. Fijar el body en su posición actual sí lo detiene, y al
 * cerrar se restaura exactamente donde estaba la dueña.
 */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      Object.assign(body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
