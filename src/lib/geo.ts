export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distancia en línea recta entre dos puntos (fórmula de haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Distancia (km) del punto `p` al segmento más cercano de la polilínea
 * `coords` ([lng, lat]). Se usa para saber si el usuario se salió de la ruta
 * y debe recalcularse, y para estimar el progreso.
 */
export function distanceToPolylineKm(
  p: LatLng,
  coords: [number, number][],
): number {
  if (coords.length === 0) return Infinity;
  let min = Infinity;
  let prev = coords[0];
  for (let i = 1; i < coords.length; i++) {
    const curr = coords[i];
    const d = segmentDistanceKm(p, prev, curr);
    if (d < min) min = d;
    prev = curr;
  }
  return min;
}

/** Distancia del punto al segmento [a,b] proyectando sobre él (en km). */
function segmentDistanceKm(
  p: LatLng,
  a: [number, number],
  b: [number, number],
): number {
  const ax = a[0];
  const ay = a[1];
  const bx = b[0];
  const by = b[1];
  const denom = (bx - ax) ** 2 + (by - ay) ** 2;
  let t =
    denom === 0
      ? 0
      : ((p.lng - ax) * (bx - ax) + (p.lat - ay) * (by - ay)) / denom;
  t = Math.max(0, Math.min(1, t));
  const proj: LatLng = { lat: ay + t * (by - ay), lng: ax + t * (bx - ax) };
  return haversineKm(p, proj);
}
