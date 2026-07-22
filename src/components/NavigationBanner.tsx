import { useState, useEffect } from "react";
import { useRouteStore } from "../state/routeStore";
import { haversineKm } from "../lib/geo";
import { isMuted, toggleMuted } from "../lib/speech";
import { ArrowRightIcon, CheckIcon, CloseIcon } from "./icons";
import { VolumeIcon, MuteIcon } from "./icons";

export function NavigationBanner() {
  const tracking = useRouteStore((s) => s.tracking);
  const live = useRouteStore((s) => s.live);
  const stops = useRouteStore((s) => s.stops);
  const stopTracking = useRouteStore((s) => s.stopTracking);
  const markStopDelivered = useRouteStore((s) => s.markStopDelivered);

  const [muted, setMutedState] = useState(isMuted());

  const pendingStops = stops.filter((s) => !s.delivered);
  const nextStop = pendingStops[0];

  useEffect(() => {
    setMutedState(isMuted());
  }, [tracking]);

  if (!tracking || !nextStop) return null;

  let distanceText = "Calculando...";
  let etaText = "";

  if (live) {
    const km = haversineKm(live, nextStop) * 1.25;
    const m = Math.round(km * 1000);
    if (m < 1000) {
      distanceText = `a ${m} m`;
    } else {
      distanceText = `a ${km.toFixed(1)} km`;
    }
    const min = Math.round((km / 20) * 60);
    etaText = `~${min} min`;
  }

  const handleToggleVoice = () => {
    const newState = toggleMuted();
    setMutedState(newState);
  };

  const handleDeliver = () => {
    markStopDelivered(nextStop.id);
  };

  return (
    <div className="nav-banner">
      <div className="nav-banner-top">
        <div className="nav-banner-badge">
          <ArrowRightIcon size={16} />
        </div>
        <div className="nav-banner-info">
          <div className="nav-banner-distance">
            <strong>{distanceText}</strong> {etaText && <span className="nav-banner-eta">· {etaText}</span>}
          </div>
          <div className="nav-banner-target" title={nextStop.label}>
            {nextStop.label}
          </div>
        </div>
        <div className="nav-banner-actions">
          <button
            type="button"
            className={`nav-banner-btn ${muted ? "is-muted" : ""}`}
            onClick={handleToggleVoice}
            title={muted ? "Activar indicaciones de voz" : "Silenciar voz"}
            aria-label="Alternar voz"
          >
            {muted ? <MuteIcon size={18} /> : <VolumeIcon size={18} />}
          </button>
          <button
            type="button"
            className="nav-banner-btn nav-banner-btn--close"
            onClick={stopTracking}
            title="Detener navegación en vivo"
            aria-label="Salir de navegación"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>
      <div className="nav-banner-bottom">
        <button
          type="button"
          className="nav-banner-deliver-btn"
          onClick={handleDeliver}
        >
          <CheckIcon size={15} /> Entregada en este punto
        </button>
      </div>
    </div>
  );
}
