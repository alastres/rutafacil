import { useState } from "react";
import { toast } from "react-hot-toast";
import { haversineKm, type LatLng } from "../lib/geo";
import { optimizeOrder } from "../lib/tsp";
import { tripThroughStreets } from "../lib/routing";
import { useRouteStore, type Stop } from "../state/routeStore";
import { withLoader } from "../state/loadingStore";
import { CheckIcon } from "./icons";

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
  const beginRouteRequest = useRouteStore((s) => s.beginRouteRequest);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const optimizedKm = useRouteStore((s) => s.optimizedKm);
  const mode = useRouteStore((s) => s.mode);
  const tracking = useRouteStore((s) => s.tracking);
  const startTracking = useRouteStore((s) => s.startTracking);
  const stopTracking = useRouteStore((s) => s.stopTracking);
  const [busy, setBusy] = useState(false);

  const pending = stops.filter((s) => !s.delivered);

  const handleOptimize = async () => {
    setBusy(true);
    onMoving(true);
    const version = beginRouteRequest();
    try {
      await withLoader(async () => {
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
      const trip = await tripThroughStreets(effectiveOrigin, pending, { mode });
      if (trip) {
        const ordered: Stop[] = trip.order.map((stopIdx, i) => ({
          ...pending[stopIdx],
          legKm: trip.legsKm[i],
        }));
        applyOptimization(
          {
            ordered,
            origin: effectiveOrigin,
            km: trip.distanceKm,
            durationMin: trip.durationMin,
            geometry: trip.coordinates,
            byStreets: true,
          },
          version,
        );
        onNotify(
          `Ruta por calles armada: ${trip.distanceKm.toFixed(1)} km, ~${Math.round(trip.durationMin)} min ${origin ? "desde tu ubicación" : "desde la primera parada"}`,
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
        applyOptimization(
          {
            ordered,
            origin: effectiveOrigin,
            km,
            durationMin: null,
            geometry: null,
            byStreets: false,
          },
          version,
        );
        onNotify(
          "Sin conexión al servicio de rutas: orden calculado en línea recta. Vuelve a tocar Armar ruta cuando tengas señal.",
          true,
        );
      }
      });
    } finally {
      setBusy(false);
      // La línea de la carretera sigue "fluyendo" un momento tras reordenar
      window.setTimeout(() => onMoving(false), 2400);
    }
  };

  const handleClear = () => {
    toast(
      (t) => (
        <div className="confirm-modal" role="alertdialog" aria-label="Borrar ruta">
          <p className="confirm-modal__text">
            ¿Borrar todas las paradas y empezar una ruta nueva?
          </p>
          <div className="confirm-modal__actions">
            <button
              className="btn btn--danger"
              onClick={() => {
                toast.dismiss(t.id);
                clearRoute();
                toast.success("Ruta nueva iniciada", {
                  icon: <CheckIcon width={18} height={18} />,
                });
              }}
            >
              Borrar todo
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => toast.dismiss(t.id)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, className: "confirm-toast" },
    );
  };

  if (stops.length === 0) return null;

  return (
    <div className="bottom-bar">
      <button className="btn-map" onClick={onToggleMap}>
        {showMap ? "Lista" : "Mapa"}
      </button>
      <button
        className={`btn-track${tracking ? " is-on" : ""}`}
        onClick={() => (tracking ? stopTracking() : startTracking())}
        disabled={busy || optimizedKm === null}
        title="Seguir mi ubicación en tiempo real y recalcular si me desvío"
      >
        {tracking ? "Parar" : "Seguir"}
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
