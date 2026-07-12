import type { LatLng } from "./geo";

/**
 * Rutas por calles reales usando servidores públicos de OSRM (OpenStreetMap):
 * gratis, sin API key. El endpoint /trip resuelve el orden óptimo de visita
 * Y devuelve la geometría de la ruta por calles en una sola llamada.
 *
 * Se prueban varios servidores en orden: el demo oficial (router.project-osrm.org)
 * es notoriamente inestable y suele responder 429/503 bajo carga, lo que antes
 * hacía que la app cayera al respaldo de línea recta. Ahora, si uno falla, se
 * usa el siguiente. El primero puede sobreescribirse con VITE_OSRM_BASE para
 * apuntar a un OSRM propio (PLAN fase 4) o a un proxy.
 *
 * Sin conexión (o si todos los servidores fallan), el llamador cae al
 * cálculo en línea recta on-device.
 */
const DEFAULT_BASES = [
  "https://routing.openstreetmap.de/routed-car", // GIScience: más estable que el demo
  "https://router.project-osrm.org", // demo oficial de OSRM
];

const envBase = (import.meta.env.VITE_OSRM_BASE as string | undefined)?.trim();
const OSRM_BASES: string[] = envBase ? [envBase, ...DEFAULT_BASES] : DEFAULT_BASES;

export interface TripResult {
  /** Índices de `stops` en el orden de visita recomendado */
  order: number[];
  /** Km por calles de cada tramo, alineado con `order` */
  legsKm: number[];
  distanceKm: number;
  durationMin: number;
  /** Geometría de la ruta por calles, pares [lng, lat] para el mapa */
  coordinates: [number, number][];
  /** Base que resolvió la ruta (útil para depurar / telemetría) */
  source: string;
}

interface OsrmTripResponse {
  code: string;
  trips?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
  waypoints?: Array<{ waypoint_index: number }>;
}

/** Intenta resolver el viaje en un único servidor; null si falla o no es válido. */
async function tryBase(
  base: string,
  origin: LatLng,
  stops: LatLng[],
  timeoutMs: number,
): Promise<TripResult | null> {
  const coords = [origin, ...stops].map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `${base}/trip/v1/driving/${coords}` +
    `?roundtrip=false&source=first&geometries=geojson&overview=simplified`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null; // servidor limitado/caído → prueba el siguiente

    const data = (await res.json()) as OsrmTripResponse;
    const trip = data.trips?.[0];
    if (data.code !== "Ok" || !trip || !data.waypoints) return null;

    // waypoints[i].waypoint_index = posición de la coordenada i en el viaje
    // (i=0 es el origen; i=1..n son las paradas)
    const positions = data.waypoints.map((w) => w.waypoint_index);
    const order = stops
      .map((_, i) => i)
      .sort((a, b) => positions[a + 1] - positions[b + 1]);
    // El tramo que LLEGA a la parada en posición p del viaje es legs[p-1]
    const legsKm = order.map((stopIdx) => {
      const leg = trip.legs[positions[stopIdx + 1] - 1];
      return leg ? leg.distance / 1000 : 0;
    });

    return {
      order,
      legsKm,
      distanceKm: trip.distance / 1000,
      durationMin: trip.duration / 60,
      coordinates: trip.geometry.coordinates,
      source: base,
    };
  } catch {
    return null; // red caída, CORS, timeout → prueba el siguiente servidor
  } finally {
    clearTimeout(timer);
  }
}

export async function tripThroughStreets(
  origin: LatLng,
  stops: LatLng[],
  timeoutMs = 12000,
): Promise<TripResult | null> {
  if (stops.length === 0) return null;

  for (const base of OSRM_BASES) {
    const result = await tryBase(base, origin, stops, timeoutMs);
    if (result) return result;
  }
  return null;
}
