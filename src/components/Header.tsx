import { useRouteStore } from "../state/routeStore";
import { HistoryPanel } from "./HistoryPanel";
import { CrownIcon } from "./icons";

export function Header() {
  const stops = useRouteStore((s) => s.stops);
  const optimizedKm = useRouteStore((s) => s.optimizedKm);
  const durationMin = useRouteStore((s) => s.durationMin);
  const userTier = useRouteStore((s) => s.userTier);
  const userEmail = useRouteStore((s) => s.userEmail);
  const setAuthModalOpen = useRouteStore((s) => s.setAuthModalOpen);
  const logoutUser = useRouteStore((s) => s.logoutUser);
  const pending = stops.filter((s) => !s.delivered).length;
  const delivered = stops.length - pending;

  return (
    <header className="header">
      <div className="header-top">
        <span className="wordmark" aria-label="RutaFácil">
          <span className="wordmark-ruta">Ruta</span>
          <span className="wordmark-facil">Fácil</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {userTier === "pro" ? (
            <button
              className="header-pro-badge header-pro-badge--active"
              onClick={logoutUser}
              title={`PRO activo (${userEmail}). Clic para salir.`}
            >
              <CrownIcon size={14} />
              <span>PRO</span>
            </button>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="header-pro-badge header-pro-badge--inactive"
              title="Restaurar suscripción / Ingresar"
            >
              <span>Entrar / PRO</span>
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
