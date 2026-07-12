import { isValidLatLng } from "./geo";

export type ParseResult =
  | { kind: "ok"; lat: number; lng: number; label?: string }
  | { kind: "short-link"; url: string }
  | { kind: "none" };

const COORD = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const SEP = String.raw`\s*,\s*`;

/**
 * Dominios de enlaces acortados que no se pueden resolver desde el navegador
 * (la redirección no expone cabeceras CORS). Se detectan para avisar al
 * usuario; la resolución automática requiere un worker (fase 2 del plan).
 */
const SHORT_LINK = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\/\S+/i;

/** Patrones de coordenadas, del más preciso al más genérico. */
const PATTERNS: RegExp[] = [
  // Google Maps: ...!3d<lat>!4d<lng> (coordenadas exactas del pin)
  new RegExp(String.raw`!3d${COORD}!4d${COORD}`),
  // geo:lat,lng (estándar Android, lo usa WhatsApp)
  new RegExp(String.raw`geo:${COORD}${SEP}${COORD}`, "i"),
  // Parámetros q=, ll=, query=, destination=, center= (Google, Waze, Apple)
  new RegExp(String.raw`[?&](?:q|ll|query|destination|center)=${COORD}(?:%2C|,)\s*${COORD}`, "i"),
  // Google Maps: /@lat,lng,zoom (centro del mapa; menos preciso que !3d!4d)
  new RegExp(String.raw`/@${COORD}${SEP}${COORD}`),
  // Coordenadas sueltas: "4.6486, -74.0628"
  new RegExp(String.raw`(?:^|\s)${COORD}${SEP}${COORD}(?:$|\s)`),
];

/** Extrae el nombre del lugar de una URL /maps/place/<nombre>/... */
function extractLabel(text: string): string | undefined {
  const m = text.match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return undefined;
  try {
    const label = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    // Si el "nombre" son solo coordenadas, no sirve como etiqueta
    if (/^-?\d/.test(label)) return undefined;
    return label;
  } catch {
    return undefined;
  }
}

/**
 * Interpreta el texto que llega por el menú Compartir (o pegado a mano)
 * y extrae una coordenada si la hay.
 */
export function parseSharedText(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { kind: "none" };

  for (const pattern of PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isValidLatLng(lat, lng)) {
      return { kind: "ok", lat, lng, label: extractLabel(text) };
    }
  }

  const short = text.match(SHORT_LINK);
  if (short) return { kind: "short-link", url: short[0] };

  return { kind: "none" };
}
