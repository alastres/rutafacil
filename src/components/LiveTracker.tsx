import { useEffect, useRef } from "react";
import { useRouteStore, type Stop } from "../state/routeStore";
import { withLoader } from "../state/loadingStore";
import { tripThroughStreets } from "../lib/routing";
import { distanceToPolylineKm, type LatLng } from "../lib/geo";
import { showToast } from "../lib/toast";
import { AlertIcon, CheckIcon } from "./icons";

/** A partir de qué desviación (m) se recalcula la ruta */
const DEVIATION_M = 60;
/** Tiempo mínimo entre recálculos automáticos */
const REROUTE_COOLDOWN_MS = 20000;

function notifyError(text: string) {
  showToast(text, { icon: <AlertIcon width={18} height={18} />, className: "rht rht--error" });
}

/**
 * Observa la posición GPS del usuario en vivo (watchPosition) y la guarda en
 * el store para que el mapa y la lista la reflejen. Si el usuario se sale de la
 * ruta (desviación > DEVIATION_M), recalcula automáticamente desde su posición.
 * No renderiza nada: es un efecto global montado en App.
 */
export function LiveTracker() {
  const tracking = useRouteStore((s) => s.tracking);
  const lastReroute = useRef(0);

  useEffect(() => {
    if (!tracking) return;
    if (!navigator.geolocation) {
      notifyError("Este dispositivo no soporta geolocalización.");
      useRouteStore.getState().stopTracking();
      return;
    }

    let rerouting = false;
    let gotFix = false;
    // Avisa si pasa un rato sin ninguna posición (p. ej. permiso de GPS pendiente)
    const noFixTimer = window.setTimeout(() => {
      if (!gotFix) {
        notifyError(
          "No se recibe tu ubicación. Revisa el permiso de GPS y que la app esté en HTTPS.",
        );
      }
    }, 10000);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true;
        window.clearTimeout(noFixTimer);
        const p: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const store = useRouteStore.getState();
        store.setLive(p);

        const { geometry, stops } = store;
        const pending = stops.filter((s) => !s.delivered);
        if (geometry && pending.length > 0 && !rerouting) {
          const devM = distanceToPolylineKm(p, geometry) * 1000;
          const now = Date.now();
          if (devM > DEVIATION_M && now - lastReroute.current > REROUTE_COOLDOWN_MS) {
            lastReroute.current = now;
            rerouting = true;
            void reroute(pending, p).finally(() => {
              rerouting = false;
            });
          }
        }
      },
      (err) => {
        window.clearTimeout(noFixTimer);
        notifyError(`No puedo seguir tu ubicación: ${err.message}`);
        useRouteStore.getState().stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => {
      window.clearTimeout(noFixTimer);
      navigator.geolocation.clearWatch(id);
    };
  }, [tracking]);

  return null;
}

async function reroute(pending: Stop[], from: LatLng) {
  const { mode, returnPoint } = useRouteStore.getState();
  const version = useRouteStore.getState().beginRouteRequest();
  const trip = await withLoader(() =>
    tripThroughStreets(from, pending, { mode, returnPoint: returnPoint ?? undefined }),
  );
  if (!trip) return;
  const ordered = trip.order.map((i, idx) => ({
    ...pending[i],
    legKm: trip.legsKm[idx],
  }));
  useRouteStore.getState().applyOptimization(
    {
      ordered,
      origin: from,
      km: trip.distanceKm,
      durationMin: trip.durationMin,
      geometry: trip.coordinates,
      byStreets: true,
      returnLegKm: trip.returnLegKm ?? null,
    },
    version,
  );
  showToast("Ruta recalculada desde tu posición", {
    icon: <CheckIcon width={18} height={18} />,
    className: "rht",
  });
}
