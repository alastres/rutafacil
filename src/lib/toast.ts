import toast, { type ToastOptions } from "react-hot-toast";

const DEFAULT_DURATION = 4000;

/**
 * react-hot-toast pausa el cierre automático de TODOS los avisos mientras
 * el puntero está "sobre" su contenedor (onMouseEnter/onMouseLeave en el
 * div raíz). En móvil, un toque cerca del aviso dispara ese mouseenter sin
 * el mouseleave correspondiente, y el aviso queda pegado en pantalla para
 * siempre — el resto de avisos futuros también dejan de auto-cerrarse
 * mientras dure esa pausa "fantasma". Por eso agendamos el cierre con un
 * timer propio en vez de confiar en el `duration` interno de la librería,
 * que si depende de ese estado de pausa.
 *
 * Los popups de confirmación (borrar ruta, etc.) siguen usando `toast()`
 * directo con `duration: Infinity` — esos deben quedarse hasta que el
 * usuario responda, así que no pasan por aquí.
 */
function scheduleDismiss(id: string, duration: number) {
  window.setTimeout(() => toast.dismiss(id), duration);
  return id;
}

export function showToast(message: string, options?: ToastOptions): string {
  const duration = options?.duration ?? DEFAULT_DURATION;
  return scheduleDismiss(toast(message, { ...options, duration: Infinity }), duration);
}

export function showSuccessToast(message: string, options?: ToastOptions): string {
  const duration = options?.duration ?? DEFAULT_DURATION;
  return scheduleDismiss(toast.success(message, { ...options, duration: Infinity }), duration);
}
