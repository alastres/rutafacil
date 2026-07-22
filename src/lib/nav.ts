import type { LatLng } from "./geo";

export type NavApp = "google" | "waze" | "osmand" | "inapp";

export interface NavAppOption {
  id: NavApp;
  name: string;
  description: string;
}

export const NAV_APP_OPTIONS: NavAppOption[] = [
  { id: "google", name: "Google Maps", description: "Navegación estándar" },
  { id: "waze", name: "Waze", description: "Tráfico en tiempo real" },
  { id: "osmand", name: "OsmAnd", description: "100% Offline" },
  { id: "inapp", name: "In-App", description: "Guiado integrado con voz" },
];

const NAV_APP_STORAGE_KEY = "rutafacil_preferred_nav_app";

export function getPreferredNavApp(): NavApp {
  if (typeof localStorage === "undefined") return "google";
  const saved = localStorage.getItem(NAV_APP_STORAGE_KEY) as NavApp | null;
  return saved && NAV_APP_OPTIONS.some((o) => o.id === saved) ? saved : "google";
}

export function setPreferredNavApp(app: NavApp): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(NAV_APP_STORAGE_KEY, app);
  }
}

/** Deep link a Google Maps en modo navegación hacia la parada. */
export function googleMapsNavUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
}

/** Deep link a Waze en modo navegación hacia la parada. */
export function wazeNavUrl(p: LatLng): string {
  return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
}

/** Deep link a OsmAnd en modo navegación hacia la parada. */
export function osmandNavUrl(p: LatLng, profile = "car"): string {
  return `osmand.api://navigate?dest_lat=${p.lat}&dest_lon=${p.lng}&profile=${profile}&force=true`;
}

/**
 * Obtiene la URL de navegación adecuada según el navegador seleccionado.
 */
export function getNavUrl(p: LatLng, app: NavApp = getPreferredNavApp(), mode = "car"): string {
  switch (app) {
    case "waze":
      return wazeNavUrl(p);
    case "osmand":
      return osmandNavUrl(p, mode === "bike" ? "bicycle" : mode === "foot" ? "pedestrian" : "car");
    case "google":
    default:
      return googleMapsNavUrl(p);
  }
}
