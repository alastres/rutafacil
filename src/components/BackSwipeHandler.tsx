import { useEffect, useRef, type ReactNode } from "react";
import { activeOverlays } from "../lib/overlays";

export default function BackSwipeHandler({ children }: { children: ReactNode }) {
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    // 1. Detectar deslizamiento a la derecha a nivel global (soporta Portales)
    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const diffX = endX - startX.current;
      const diffY = endY - startY.current;

      // Swipe horizontal hacia la derecha:
      // Desplazamiento mínimo de 70px, predominantemente horizontal (X > 1.5 * Y)
      if (diffX > 70 && diffX > Math.abs(diffY) * 1.5) {
        const closed = activeOverlays.closeLast();
        if (!closed) {
          window.history.back();
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
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
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return <div className="back-swipe-handler">{children}</div>;
}
