import type { LatLng } from "./geo";

/** Deep link a Google Maps en modo navegación hacia la parada. */
export function googleMapsNavUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
}

/** Deep link a Waze en modo navegación hacia la parada. */
export function wazeNavUrl(p: LatLng): string {
  return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
}
