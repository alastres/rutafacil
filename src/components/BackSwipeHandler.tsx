import { useEffect, useRef, type ReactNode } from "react";
import { activeOverlays } from "../lib/overlays";

export default function BackSwipeHandler({ children }: { children: ReactNode }) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isMultiTouch = useRef(false);
  const isMapTouch = useRef(false);

  useEffect(() => {
    // 1. Detectar deslizamiento a la derecha a nivel global (soporta Portales)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        isMultiTouch.current = true;
        return;
      }
      isMultiTouch.current = false;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest(".maplibregl-canvas") ||
          target.closest(".mapboxgl-canvas") ||
          target.closest(".point-picker") ||
          target.closest(".map-container-fill"))
      ) {
        isMapTouch.current = true;
        return;
      }
      isMapTouch.current = false;

      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        isMultiTouch.current = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isMultiTouch.current || isMapTouch.current) {
        if (e.touches.length === 0) {
          isMultiTouch.current = false;
          isMapTouch.current = false;
        }
        return;
      }

      if (e.changedTouches.length === 0) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const diffX = endX - startX.current;
      const diffY = endY - startY.current;

      // Swipe horizontal hacia la derecha de 1 solo dedo fuera del mapa:
      // Desplazamiento mínimo de 70px, predominantemente horizontal (X > 1.5 * Y)
      if (diffX > 70 && diffX > Math.abs(diffY) * 1.5) {
        const closed = activeOverlays.closeLast();
        if (!closed) {
          window.history.back();
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    // 2. Interceptar botón físico Atrás del móvil (popstate)
    const handlePopState = (e: PopStateEvent) => {
      const closed = activeOverlays.handlePopState();
      if (closed) {
        e.preventDefault();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return <div className="back-swipe-handler">{children}</div>;
}
