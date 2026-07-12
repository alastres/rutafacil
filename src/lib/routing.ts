import type { LatLng } from "./geo";

/**
 * Rutas por calles reales usando el servidor público de OSRM (OpenStreetMap):
 * gratis, sin API key. El endpoint /trip resuelve el orden óptimo de visita
 * Y devuelve la geometría de la ruta por calles en una sola llamada.
 *
 * Sin conexión (o si el servidor demo no responde), el llamador cae al
 * cálculo en línea recta on-device.
 */
const OSRM = "https://router.project-osrm.org";

export interface TripResult {
  /** Índices de `stops` en el orden de visita recomendado */
  order: number[];
  /** Km por calles de cada tramo, alineado con `order` */
  legsKm: number[];
  distanceKm: number;
  durationMin: number;
  /** Geometría de la ruta por calles, pares [lng, lat] para el mapa */
  coordinates: [number, number][];
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

export async function tripThroughStreets(
  origin: LatLng,
  stops: LatLng[],
  timeoutMs = 12000,
): Promise<TripResult | null> {
  if (stops.length === 0) return null;

  const coords = [origin, ...stops].map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `${OSRM}/trip/v1/driving/${coords}` +
    `?roundtrip=false&source=first&geometries=geojson&overview=simplified`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

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
    };
  } catch {
    return null;
  }
}
