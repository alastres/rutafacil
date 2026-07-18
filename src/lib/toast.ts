import { createElement, type MouseEvent } from "react";
import toast, { type ToastOptions } from "react-hot-toast";

const DEFAULT_DURATION = 4000;

type ToastHandler = (message: unknown, options?: ToastOptions) => string;

interface ToastGroup {
  id: string;
  count: number;
  messages: string[];
  expanded: boolean;
  timer: ReturnType<typeof window.setTimeout>;
  method: ToastHandler;
  options?: ToastOptions;
}

/** Repeticiones activas, por variante + clase + texto exacto del mensaje. */
const groups = new Map<string, ToastGroup>();

function GroupContent({ entry }: { entry: ToastGroup }) {
  return createElement(
    "span",
    { className: "rht-group" },
    createElement(
      "span",
      { className: "rht-group__text" },
      entry.expanded
        ? entry.messages.map((m, i) =>
            createElement("span", { className: "rht-group__line", key: i }, m),
          )
        : entry.messages[0],
    ),
    entry.count > 1 &&
      createElement(
        "button",
        {
          type: "button",
          className: "rht-group__badge",
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            entry.expanded = !entry.expanded;
            renderGroup(entry);
          },
          "aria-label": entry.expanded
            ? "Contraer avisos repetidos"
            : `Mostrar los ${entry.count} avisos repetidos`,
        },
        entry.expanded ? "−" : `×${entry.count}`,
      ),
  );
}

function renderGroup(entry: ToastGroup) {
  entry.method(() => createElement(GroupContent, { entry }), {
    ...entry.options,
    id: entry.id,
    duration: Infinity,
  });
}

/**
 * react-hot-toast pausa el cierre automático de TODOS los avisos mientras
 * el puntero está "sobre" su contenedor (onMouseEnter/onMouseLeave en el
 * div raíz). En móvil, un toque cerca del aviso dispara ese mouseenter sin
 * el mouseleave correspondiente, y el aviso queda pegado en pantalla para
 * siempre — el resto de avisos futuros también dejan de auto-cerrarse
 * mientras dure esa pausa "fantasma". Por eso agendamos el cierre con un
 * timer propio en vez de confiar en el `duration` interno de la librería.
 *
 * Además, si llega un aviso idéntico (mismo texto y mismo tipo) mientras
 * el anterior sigue en pantalla, no se apila uno nuevo: se agrega un badge
 * con la cantidad de repeticiones. El badge es clicable y alterna entre
 * mostrar solo el último aviso o la lista completa, sin tocar el tiempo
 * de cierre pendiente (solo una repetición nueva lo reinicia).
 *
 * Los popups de confirmación (borrar ruta, etc.) siguen usando `toast()`
 * directo con `duration: Infinity` — esos deben quedarse hasta que el
 * usuario responda, así que no pasan por aquí.
 */
function pushToast(method: ToastHandler, message: string, options?: ToastOptions): string {
  const duration = options?.duration ?? DEFAULT_DURATION;
  const key = `${method === (toast.success as unknown as ToastHandler) ? "success" : "default"}::${options?.className ?? ""}::${message}`;

  const existing = groups.get(key);
  if (existing) {
    existing.count += 1;
    existing.messages.push(message);
    renderGroup(existing);
    window.clearTimeout(existing.timer);
    existing.timer = window.setTimeout(() => {
      toast.dismiss(existing.id);
      groups.delete(key);
    }, duration);
    return existing.id;
  }

  const entry: ToastGroup = {
    id: "",
    count: 1,
    messages: [message],
    expanded: false,
    timer: 0,
    method,
    options,
  };
  entry.id = method(() => createElement(GroupContent, { entry }), {
    ...options,
    duration: Infinity,
  });
  entry.timer = window.setTimeout(() => {
    toast.dismiss(entry.id);
    groups.delete(key);
  }, duration);
  groups.set(key, entry);
  return entry.id;
}

export function showToast(message: string, options?: ToastOptions): string {
  return pushToast(toast as unknown as ToastHandler, message, options);
}

export function showSuccessToast(message: string, options?: ToastOptions): string {
  return pushToast(toast.success as unknown as ToastHandler, message, options);
}
