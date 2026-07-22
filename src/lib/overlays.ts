type Closer = () => void;
const closers: Closer[] = [];
let isHandlingPopState = false;
let isHandlingBack = false;

export const activeOverlays = {
  register(closeFn: Closer, pushHistory = true) {
    closers.push(closeFn);

    if (pushHistory) {
      // Guardar estado en el historial del navegador para capturar el botón físico "Atrás"
      window.history.pushState({ overlay: true }, "");
    }

    return () => {
      const idx = closers.indexOf(closeFn);
      if (idx !== -1) {
        closers.splice(idx, 1);

        // Si se cerró manualmente desde código, retrocedemos en el historial para limpiar el estado
        if (pushHistory && !isHandlingPopState) {
          isHandlingBack = true;
          window.history.back();
          setTimeout(() => {
            isHandlingBack = false;
          }, 100);
        }
      }
    };
  },
  closeLast(): boolean {
    const last = closers[closers.length - 1];
    if (last) {
      last();
      return true;
    }
    return false;
  },
  handlePopState(): boolean {
    // Si el popstate fue producido por nuestro propio history.back() al cerrar un overlay, no cerrar el padre
    if (isHandlingBack) {
      return false;
    }
    if (closers.length > 0) {
      isHandlingPopState = true;
      this.closeLast();
      isHandlingPopState = false;
      return true;
    }
    return false;
  },
  hasActive(): boolean {
    return closers.length > 0;
  },
};
