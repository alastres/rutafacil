import { haversineKm, type LatLng } from "./geo";

/**
 * Ordena las paradas para minimizar la distancia total partiendo del origen
 * (camino abierto: no vuelve al punto de partida).
 *
 * Heurística: vecino más cercano + mejora 2-opt. Para las ≤30 paradas de una
 * jornada de reparto corre en milisegundos y queda a un dígito porcentual del
 * óptimo — suficiente mientras la distancia sea en línea recta.
 *
 * Devuelve los índices de `stops` en el orden recomendado.
 */
export function optimizeOrder(origin: LatLng, stops: LatLng[]): number[] {
  const n = stops.length;
  if (n <= 1) return stops.map((_, i) => i);

  // Matriz de distancias: índice 0 = origen, 1..n = paradas
  const points = [origin, ...stops];
  const dist: number[][] = points.map((a) =>
    points.map((b) => haversineKm(a, b)),
  );

  // Vecino más cercano desde el origen
  const visited = new Array<boolean>(n + 1).fill(false);
  visited[0] = true;
  const path: number[] = [0];
  let current = 0;
  for (let step = 0; step < n; step++) {
    let best = -1;
    let bestDist = Infinity;
    for (let j = 1; j <= n; j++) {
      if (!visited[j] && dist[current][j] < bestDist) {
        bestDist = dist[current][j];
        best = j;
      }
    }
    visited[best] = true;
    path.push(best);
    current = best;
  }

  // 2-opt: invierte segmentos mientras acorte el camino (origen fijo)
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n; i++) {
      for (let k = i + 1; k <= n; k++) {
        const a = path[i - 1];
        const b = path[i];
        const c = path[k];
        const d = k + 1 <= n ? path[k + 1] : null;
        const before = dist[a][b] + (d !== null ? dist[c][d] : 0);
        const after = dist[a][c] + (d !== null ? dist[b][d] : 0);
        if (after < before - 1e-9) {
          let lo = i;
          let hi = k;
          while (lo < hi) {
            [path[lo], path[hi]] = [path[hi], path[lo]];
            lo++;
            hi--;
          }
          improved = true;
        }
      }
    }
  }

  // Traducir a índices de `stops` (restar el origen)
  return path.slice(1).map((p) => p - 1);
}

/** Distancia total del camino origen → paradas en el orden dado. */
export function pathLengthKm(origin: LatLng, orderedStops: LatLng[]): number {
  let total = 0;
  let prev = origin;
  for (const stop of orderedStops) {
    total += haversineKm(prev, stop);
    prev = stop;
  }
  return total;
}
