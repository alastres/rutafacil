import { useState } from "react";
import { haversineKm, type LatLng } from "../lib/geo";
import { optimizeOrder } from "../lib/tsp";
import { tripThroughStreets } from "../lib/routing";
import { useRouteStore, type Stop } from "../state/routeStore";

function getPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("sin geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

/** Distingue "permiso bloqueado" (hay que ir a ajustes) de un fallo puntual. */
async function geolocationDenied(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "denied";
  } catch {
    return false;
  }
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
  const applyOptimization = useRouteStore((s) => s.applyOptimization);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const [busy, setBusy] = useState(false);

  const pending = stops.filter((s) => !s.delivered);

  const handleOptimize = async () => {
    setBusy(true);
    onMoving(true);
    try {
      let origin: LatLng | null = null;
      try {
        origin = await getPosition();
      } catch {
        onNotify(
          (await geolocationDenied())
            ? "La ubicación está bloqueada para RutaFácil. Actívala: toca el candado en la barra de direcciones (o mantén presionado el ícono de la app → Información → Permisos) → Ubicación → Permitir."
            : "No pude obtener tu ubicación (¿GPS apagado?). La ruta parte de la primera parada.",
          true,
        );
      }
      const effectiveOrigin = origin ?? pending[0];

      // Primero por calles reales (OSRM); si no hay conexión, línea recta
      const trip = await tripThroughStreets(effectiveOrigin, pending);
      if (trip) {
        const ordered: Stop[] = trip.order.map((stopIdx, i) => ({
          ...pending[stopIdx],
          legKm: trip.legsKm[i],
        }));
        applyOptimization({
          ordered,
          origin: effectiveOrigin,
          km: trip.distanceKm,
          durationMin: trip.durationMin,
          geometry: trip.coordinates,
          byStreets: true,
        });
        onNotify(
          `Ruta por calles armada: ${trip.distanceKm.toFixed(1)} km, ~${Math.round(trip.durationMin)} min ${origin ? "desde tu ubicación" : "desde la primera parada"} ✓`,
        );
      } else {
        const order = optimizeOrder(effectiveOrigin, pending);
        let prev: LatLng = effectiveOrigin;
        const ordered: Stop[] = order.map((i) => {
          const stop = { ...pending[i], legKm: haversineKm(prev, pending[i]) };
          prev = stop;
          return stop;
        });
        const km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
        applyOptimization({
          ordered,
          origin: effectiveOrigin,
          km,
          durationMin: null,
          geometry: null,
          byStreets: false,
        });
        onNotify(
          "Sin conexión al servicio de rutas: orden calculado en línea recta. Vuelve a tocar Armar ruta cuando tengas señal.",
          true,
        );
      }
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
