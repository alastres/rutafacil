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

export interface FoundLocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface BulkParseResult {
  locations: FoundLocation[];
  shortLinks: string[];
}

/**
 * Extrae TODAS las ubicaciones de un texto (p. ej. una conversación entera
 * de WhatsApp copiada y pegada). Cada URL aporta a lo sumo una ubicación;
 * las coordenadas sueltas del texto restante también cuentan. Los enlaces
 * acortados se devuelven aparte para resolverlos vía /api/resolve.
 */
export function parseAllLocations(raw: string): BulkParseResult {
  const text = raw.trim();
  const shortLinks: string[] = [];
  const found: Array<FoundLocation & { index: number }> = [];

  // URLs y URIs geo: — cada una se interpreta individualmente
  const urlRe = /(?:https?:\/\/\S+|geo:\S+)/gi;
  // El texto restante se enmascara con espacios (mismo largo) para que los
  // índices de las coordenadas sueltas sigan siendo los del texto original
  let masked = text;
  for (const m of text.matchAll(urlRe)) {
    const index = m.index ?? 0;
    masked =
      masked.slice(0, index) +
      " ".repeat(m[0].length) +
      masked.slice(index + m[0].length);
    const r = parseSharedText(m[0]);
    if (r.kind === "ok") found.push({ lat: r.lat, lng: r.lng, label: r.label, index });
    else if (r.kind === "short-link") shortLinks.push(r.url);
  }

  // Coordenadas sueltas en el texto que queda
  const bare = new RegExp(
    String.raw`(?:^|\s)${COORD}${SEP}${COORD}(?=$|\s)`,
    "g",
  );
  for (const m of masked.matchAll(bare)) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isValidLatLng(lat, lng)) found.push({ lat, lng, index: m.index ?? 0 });
  }

  // Orden del texto original (el orden en que llegaron los pedidos) y sin duplicados
  found.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const locations: FoundLocation[] = [];
  for (const { lat, lng, label } of found) {
    const key = `${lat},${lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({ lat, lng, label });
  }

  return { locations, shortLinks };
}
