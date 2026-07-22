import type { LatLng } from "./geo";

export interface GpxStop {
  lat: number;
  lng: number;
  label: string;
  delivered?: boolean;
}

/**
 * Genera un archivo XML en formato GPX 1.1 con las paradas y el punto de origen.
 * Compatible con OsmAnd, Garmin, Locus Map y cualquier software GPS.
 */
export function generateGpx(
  stops: GpxStop[],
  origin?: LatLng | null,
  routeName = "RutaFácil - Reparto"
): string {
  const pendingStops = stops.filter((s) => !s.delivered);
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<gpx version="1.1" creator="RutaFácil (https://rutafacil.app)" xmlns="http://www.topografix.com/GPX/1/1">\n`;
  xml += `  <metadata>\n`;
  xml += `    <name>${escapeXml(routeName)}</name>\n`;
  xml += `    <time>${now}</time>\n`;
  xml += `  </metadata>\n`;

  // Waypoint para el punto de origen si existe
  if (origin) {
    xml += `  <wpt lat="${origin.lat}" lon="${origin.lng}">\n`;
    xml += `    <name>Origen (Tú)</name>\n`;
    xml += `    <sym>Departure</sym>\n`;
    xml += `  </wpt>\n`;
  }

  // Waypoints para cada parada pendiente
  pendingStops.forEach((stop, idx) => {
    xml += `  <wpt lat="${stop.lat}" lon="${stop.lng}">\n`;
    xml += `    <name>Parada ${idx + 1}: ${escapeXml(stop.label)}</name>\n`;
    xml += `    <sym>Flag, Blue</sym>\n`;
    xml += `  </wpt>\n`;
  });

  // Ruta / Track ordenado
  xml += `  <rte>\n`;
  xml += `    <name>${escapeXml(routeName)}</name>\n`;
  if (origin) {
    xml += `    <rtept lat="${origin.lat}" lon="${origin.lng}">\n`;
    xml += `      <name>Inicio</name>\n`;
    xml += `    </rtept>\n`;
  }
  pendingStops.forEach((stop, idx) => {
    xml += `    <rtept lat="${stop.lat}" lon="${stop.lng}">\n`;
    xml += `      <name>Parada ${idx + 1}</name>\n`;
    xml += `    </rtept>\n`;
  });
  xml += `  </rte>\n`;

  xml += `</gpx>`;
  return xml;
}

/**
 * Activa la descarga directa del archivo .gpx en el navegador.
 */
export function downloadGpx(
  stops: GpxStop[],
  origin?: LatLng | null,
  routeName = "rutafacil_reparto"
): void {
  const content = generateGpx(stops, origin, routeName);
  const blob = new Blob([content], { type: "application/gpx+xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = `${routeName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.gpx`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
