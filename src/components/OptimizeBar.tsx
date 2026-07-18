import { useState } from "react";
import { toast } from "react-hot-toast";
import { getPosition, haversineKm, type LatLng } from "../lib/geo";
import { optimizeOrder } from "../lib/tsp";
import { tripThroughStreets } from "../lib/routing";
import { useRouteStore, type Stop } from "../state/routeStore";
import { withLoader } from "../state/loadingStore";
import { showSuccessToast } from "../lib/toast";
import { CheckIcon, ListIcon, TrackIcon, RouteIcon, TrashIcon } from "./icons";

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
  onToggleList,
}: {
  onNotify: (text: string, error?: boolean) => void;
  onMoving: (moving: boolean) => void;
  onToggleList: () => void;
}) {
  const stops = useRouteStore((s) => s.stops);
  const applyOptimization = useRouteStore((s) => s.applyOptimization);
  const beginRouteRequest = useRouteStore((s) => s.beginRouteRequest);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const optimizedKm = useRouteStore((s) => s.optimizedKm);
  const returnPoint = useRouteStore((s) => s.returnPoint);
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
      const returnLatLng = returnPoint ?? undefined;

      // Primero por calles reales (OSRM); si no hay conexión, línea recta
      const trip = await tripThroughStreets(effectiveOrigin, pending, {
        mode,
        returnPoint: returnLatLng,
      });
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
            returnLegKm: trip.returnLegKm ?? null,
          },
          version,
        );
        onNotify(
          `Ruta por calles armada: ${trip.distanceKm.toFixed(1)} km, ~${Math.round(trip.durationMin)} min ${origin ? "desde tu ubicación" : "desde la primera parada"}`,
        );
      } else {
        const order = optimizeOrder(effectiveOrigin, pending, returnLatLng);
        let prev: LatLng = effectiveOrigin;
        const ordered: Stop[] = order.map((i) => {
          const stop = { ...pending[i], legKm: haversineKm(prev, pending[i]) };
          prev = stop;
          return stop;
        });
        let km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
        let returnLegKm: number | null = null;
        if (returnLatLng) {
          returnLegKm = haversineKm(prev, returnLatLng);
          km += returnLegKm;
        }
        applyOptimization(
          {
            ordered,
            origin: effectiveOrigin,
            km,
            durationMin: null,
            geometry: null,
            byStreets: false,
            returnLegKm,
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
                showSuccessToast("Ruta nueva iniciada", {
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
      <button className="btn-map bottom-bar-btn" onClick={onToggleList} title="Ver lista de paradas">
        <ListIcon size={18} />
        <span className="btn-label">Lista</span>
      </button>
      <button
        className={`btn-track bottom-bar-btn${tracking ? " is-on" : ""}`}
        onClick={() => (tracking ? stopTracking() : startTracking())}
        disabled={busy || optimizedKm === null}
        title="Seguir mi ubicación en tiempo real y recalcular si me desvío"
      >
        <TrackIcon size={18} />
        <span className="btn-label">{tracking ? "Parar" : "Seguir"}</span>
      </button>
      <button
        className="btn-optimize bottom-bar-btn"
        onClick={handleOptimize}
        disabled={busy || pending.length < 2}
        title="Calcular ruta óptima"
      >
        <RouteIcon size={18} />
        <span className="btn-label">{busy ? "Calculando" : "Armar"}</span>
      </button>
      <button className="btn-clear bottom-bar-btn" onClick={handleClear} title="Nueva ruta">
        <TrashIcon size={18} />
        <span className="btn-label">Nueva</span>
      </button>
    </div>
  );
}
