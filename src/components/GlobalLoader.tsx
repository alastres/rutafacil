import { useLoadingStore } from "../state/loadingStore";

/** Barra de carga fija arriba de todo, con la línea discontinua de la
 * carretera en movimiento — mismo lenguaje visual que el resto de la app. */
export function GlobalLoader() {
  const loading = useLoadingStore((s) => s.count > 0);
  return (
    <div
      className={`global-loader${loading ? " is-active" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={loading ? "Cargando" : undefined}
    />
  );
}
