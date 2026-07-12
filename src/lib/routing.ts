import type { LatLng } from "./geo";
import { optimizeOrder } from "./tsp";

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
 *
 * Opcionalmente, si VITE_ROUTING_PROVIDER=mapbox y hay VITE_MAPBOX_KEY, el
 * ruteo usa Mapbox Directions con tráfico en vivo (duration incluye congestión
 * actual). Las incidencias (opcional) se obtienen con VITE_TOMTOM_KEY.
 */
const DEFAULT_BASES = [
  "https://routing.openstreetmap.de/routed-car", // GIScience: más estable que el demo
  "https://router.project-osrm.org", // demo oficial de OSRM
];

const envBase = (import.meta.env.VITE_OSRM_BASE as string | undefined)?.trim();
const OSRM_BASES: string[] = envBase ? [envBase, ...DEFAULT_BASES] : DEFAULT_BASES;

const ROUTING_PROVIDER: "osrm" | "mapbox" =
  (import.meta.env.VITE_ROUTING_PROVIDER as "osrm" | "mapbox") || "osrm";
const MAPBOX_KEY = import.meta.env.VITE_MAPBOX_KEY as string | undefined;
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY as string | undefined;

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
  /** true si el tiempo incluye tráfico en vivo (Mapbox) */
  withTraffic?: boolean;
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

interface MapboxResponse {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
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
    `?roundtrip=false&source=first&geometries=geojson&overview=full`;

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

/**
 * Ruteo con tráfico en vivo vía Mapbox Directions (geojson, igual que OSRM).
 * Mapbox NO reordena waypoints, así que primero calculamos el orden óptimo
 * con haversine (optimizeOrder) y luego pedimos la geometría + duraciones
 * (congestionadas) en ese orden. Si no hay llave, devuelve null y se usa OSRM.
 */
async function tripMapbox(
  origin: LatLng,
  stops: LatLng[],
  timeoutMs: number,
): Promise<TripResult | null> {
  if (!MAPBOX_KEY) return null;
  const order = optimizeOrder(origin, stops);
  const sequence = [origin, ...order.map((i) => stops[i])];
  const coords = sequence.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?access_token=${MAPBOX_KEY}&geometries=geojson&overview=full&annotations=congestion,traffic`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as MapboxResponse;
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return null;

    return {
      order,
      legsKm: route.legs.map((l) => l.distance / 1000),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      coordinates: route.geometry.coordinates,
      source: "mapbox",
      withTraffic: true,
    };
  } catch {
    return null;
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

  if (ROUTING_PROVIDER === "mapbox") {
    const viaMapbox = await tripMapbox(origin, stops, timeoutMs);
    if (viaMapbox) return viaMapbox;
    // Sin llave válida o fallo → cae a OSRM gratis
  }

  for (const base of OSRM_BASES) {
    const result = await tryBase(base, origin, stops, timeoutMs);
    if (result) return result;
  }
  return null;
}

export interface Incident {
  id: string;
  lat: number;
  lng: number;
  /** Texto legible de la categoría (español) */
  category: string;
}

interface TomtomIncidentResponse {
  incidents?: Array<{
    id: string;
    geometry: { type: string; coordinates: [number, number] };
    properties?: { iconCategory?: number };
  }>;
}

const TOMTOM_CATEGORIES: Record<number, string> = {
  0: "Desconocido",
  1: "Accidente",
  2: "Hay obras",
  3: "Carretera cerrada",
  4: "Tráfico denso",
  5: "Peligro en la vía",
  6: "Hundimiento",
  7: "Hielo / nieve",
  8: "Otros",
  9: "Manifestación",
  10: "Evento deportivo",
  11: "Tráfico detenido",
};

/**
 * Incidencias de tráfico en un bounding box vía TomTom Traffic Incidents API.
 * Solo se llama si VITE_TOMTOM_KEY está configurada. Devuelve null si no hay
 * llave o falla (la app sigue funcionando sin marcadores de incidencias).
 */
export async function fetchIncidents(
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  timeoutMs = 8000,
): Promise<Incident[] | null> {
  if (!TOMTOM_KEY) return null;
  const bbox = `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`;
  const url =
    `https://api.tomtom.com/traffic/services/4/incidentDetails.json` +
    `?key=${TOMTOM_KEY}&bbox=${bbox}&projection=EPSG4326`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as TomtomIncidentResponse;
    const incidents = data.incidents ?? [];
    return incidents
      .filter((i) => i.geometry?.type === "Point")
      .map((i) => ({
        id: i.id,
        lng: i.geometry.coordinates[0],
        lat: i.geometry.coordinates[1],
        category:
          TOMTOM_CATEGORIES[i.properties?.iconCategory ?? -1] ?? "Incidencia",
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
