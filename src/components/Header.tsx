import { useRouteStore } from "../state/routeStore";
import { HistoryPanel } from "./HistoryPanel";
import { FaTruckFast } from "react-icons/fa6";

export function Header({ onOpenDispatch }: { onOpenDispatch?: () => void }) {
  const stops = useRouteStore((s) => s.stops);
  const optimizedKm = useRouteStore((s) => s.optimizedKm);
  const durationMin = useRouteStore((s) => s.durationMin);
  const pending = stops.filter((s) => !s.delivered).length;
  const delivered = stops.length - pending;

  return (
    <header className="header">
      <div className="header-top">
        <span className="wordmark" aria-label="RutaFácil">
          <span className="wordmark-ruta">Ruta</span>
          <span className="wordmark-facil">Fácil</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {onOpenDispatch && (
            <button
              type="button"
              className="header-dispatch-btn"
              onClick={onOpenDispatch}
              title="Despachar pedido por WhatsApp"
            >
              <FaTruckFast size={14} /> Despachar
            </button>
          )}
          <HistoryPanel />
        </div>
      </div>
      <div className="header-ticker" aria-live="polite">
        <span>
          {pending} {pending === 1 ? "parada" : "paradas"}
        </span>
        {delivered > 0 && <span>{delivered} entregadas</span>}
        {optimizedKm !== null && <span>{optimizedKm.toFixed(1)} km</span>}
        {durationMin !== null && <span>~{Math.round(durationMin)} min</span>}
      </div>
    </header>
  );
}
