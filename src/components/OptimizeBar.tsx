import { useState } from "react";
import type { LatLng } from "../lib/geo";
import { useRouteStore } from "../state/routeStore";

function getPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("sin geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export function OptimizeBar({
  onNotify,
  onMoving,
  showMap,
  onToggleMap,
}: {
  onNotify: (text: string, error?: boolean) => void;
  onMoving: (moving: boolean) => void;
  showMap: boolean;
  onToggleMap: () => void;
}) {
  const stops = useRouteStore((s) => s.stops);
  const optimize = useRouteStore((s) => s.optimize);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const [busy, setBusy] = useState(false);

  const pending = stops.filter((s) => !s.delivered);

  const handleOptimize = async () => {
    setBusy(true);
    onMoving(true);
    try {
      let origin: LatLng;
      try {
        origin = await getPosition();
      } catch {
        // Sin permiso de ubicación: se parte de la primera parada agregada
        origin = pending[0];
        onNotify(
          "Sin acceso a tu ubicación: la ruta parte de la primera parada. Activa el GPS para partir desde donde estás.",
          true,
        );
      }
      optimize(origin);
      onNotify("Ruta armada: el orden de paradas ya es el más corto ✓");
    } finally {
      setBusy(false);
      // La línea de la carretera sigue "fluyendo" un momento tras reordenar
      window.setTimeout(() => onMoving(false), 2400);
    }
  };

  const handleClear = () => {
    if (window.confirm("¿Borrar todas las paradas y empezar una ruta nueva?")) {
      clearRoute();
    }
  };

  if (stops.length === 0) return null;

  return (
    <div className="bottom-bar">
      <button className="btn-map" onClick={onToggleMap}>
        {showMap ? "Lista" : "Mapa"}
      </button>
      <button
        className="btn-optimize"
        onClick={handleOptimize}
        disabled={busy || pending.length < 2}
      >
        {busy ? "Calculando…" : "Armar ruta"}
      </button>
      <button className="btn-clear" onClick={handleClear}>
        Nueva
      </button>
    </div>
  );
}
