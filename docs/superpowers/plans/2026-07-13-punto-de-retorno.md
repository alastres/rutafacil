# Punto de retorno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user save named, reusable "return points" (bodega, casa, etc.) and attach one to any route, so the routing engine always places it as the last stop of the optimized path.

**Architecture:** A new IndexedDB object store (`returnPoints`) holds saved points, exposed through a thin Zustand store. The active route (`routeStore.ts`) gets a `returnPoint` snapshot field that flows into both routing engines (OSRM `destination=last`, Mapbox trailing waypoint) and the on-device haversine fallback (`optimizeOrder` with a fixed end node). New UI (`ReturnPointSheet`/`ReturnPointForm`/`MapPointPicker`) lets the user pick/create/delete saved points; `RoadList`/`MapView` render the assigned point as the final node, mirroring the existing "origin" row/marker pattern.

**Tech Stack:** React 18 + TypeScript, Zustand 5 (`persist` middleware for the active route), raw IndexedDB (no wrapper lib), MapLibre GL, Vitest.

## Global Constraints

- The return point is never a `Stop` — it never counts in `stopsTotal`/`stopsDelivered` and can't be marked "entregado".
- The return point is always the **last** node of the optimized path, in every routing path (OSRM, Mapbox, haversine fallback).
- Persistence for saved return points is IndexedDB (not localStorage) — same DB (`rutafacil-history`) as the route history, bumped to `DB_VERSION = 2`.
- Deleting a saved return point never mutates routes (active or historical) that already used it — they hold their own copy, not a foreign key.
- No test infra exists for IndexedDB/localStorage-backed code in this repo (vitest runs in the default `node` environment, no `jsdom`/`fake-indexeddb`) — don't add any. Pure-logic modules (`tsp.ts`, `routing.ts`) get real Vitest unit tests; everything touching IndexedDB/Zustand/React gets verified via `npx tsc --noEmit` per task and one full end-to-end manual pass at the end (Task 12).
- Spec: `docs/superpowers/specs/2026-07-13-punto-de-retorno-design.md`.

---

### Task 1: `optimizeOrder`/`pathLengthKm` — fixed end point

**Files:**
- Modify: `src/lib/tsp.ts`
- Test: `src/lib/tsp.test.ts`

**Interfaces:**
- Produces: `optimizeOrder(origin: LatLng, stops: LatLng[], fixedEnd?: LatLng): number[]` — indices into `stops`, in visit order, **excluding** `fixedEnd` (the caller appends it separately). `pathLengthKm(origin: LatLng, orderedStops: LatLng[], fixedEnd?: LatLng): number` — total path length, including the final leg to `fixedEnd` when given.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/tsp.test.ts` (append inside the existing `describe("optimizeOrder", ...)` block, and import `haversineKm`):

```ts
import { describe, expect, it } from "vitest";
import { haversineKm, type LatLng } from "./geo";
import { optimizeOrder, pathLengthKm } from "./tsp";
```

```ts
  it("mantiene fijo el punto de retorno al final", () => {
    const fixedEnd: LatLng = { lat: 4.7, lng: -74.08 };
    const stops: LatLng[] = [
      { lat: 4.63, lng: -74.08 }, // lejos
      { lat: 4.61, lng: -74.08 }, // cerca
      { lat: 4.62, lng: -74.08 }, // medio
    ];
    const order = optimizeOrder(origin, stops, fixedEnd);
    // visita las 3 paradas exactamente una vez; el punto de retorno no
    // pertenece a `stops`, así que nunca puede aparecer en el resultado
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    // el punto de retorno está mucho más lejos que cualquier parada, así
    // que no debería alterar el orden de cerca-a-lejos de las intermedias
    expect(order).toEqual([1, 2, 0]);
  });

  it("con punto de retorno, nunca es peor que el orden original", () => {
    const fixedEnd: LatLng = { lat: 4.55, lng: -74.03 };
    const stops: LatLng[] = Array.from({ length: 12 }, (_, i) => ({
      lat: 4.6 + Math.sin(i * 2.399) * 0.05,
      lng: -74.08 + Math.cos(i * 2.399) * 0.05,
    }));
    const order = optimizeOrder(origin, stops, fixedEnd);
    const optimized = pathLengthKm(origin, order.map((i) => stops[i]), fixedEnd);
    const original = pathLengthKm(origin, stops, fixedEnd);
    expect(optimized).toBeLessThanOrEqual(original + 1e-9);
    expect([...order].sort((a, b) => a - b)).toEqual(stops.map((_, i) => i));
  });
```

Add a new `describe` block for `pathLengthKm`:

```ts
describe("pathLengthKm", () => {
  it("suma el tramo final cuando hay punto de retorno", () => {
    const stops: LatLng[] = [{ lat: 4.61, lng: -74.08 }];
    const fixedEnd: LatLng = { lat: 4.62, lng: -74.08 };
    const withEnd = pathLengthKm(origin, stops, fixedEnd);
    const withoutEnd = pathLengthKm(origin, stops);
    expect(withEnd).toBeGreaterThan(withoutEnd);
    expect(withEnd).toBeCloseTo(withoutEnd + haversineKm(stops[0], fixedEnd), 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run src/lib/tsp.test.ts`
Expected: FAIL — `optimizeOrder`/`pathLengthKm` don't accept a third argument yet (TS type error or the extra tests produce wrong results because `fixedEnd` is silently ignored).

- [ ] **Step 3: Implement `fixedEnd` support**

Replace the full body of `optimizeOrder` in `src/lib/tsp.ts`:

```ts
export function optimizeOrder(
  origin: LatLng,
  stops: LatLng[],
  fixedEnd?: LatLng,
): number[] {
  const n = stops.length;
  if (n <= 1) return stops.map((_, i) => i);

  // Matriz de distancias: índice 0 = origen, 1..n = paradas, n+1 = punto de
  // retorno (si lo hay)
  const points = fixedEnd ? [origin, ...stops, fixedEnd] : [origin, ...stops];
  const dist: number[][] = points.map((a) =>
    points.map((b) => haversineKm(a, b)),
  );
  const endIdx = fixedEnd ? n + 1 : null;

  // Vecino más cercano desde el origen (nunca visita el punto de retorno)
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
  if (endIdx !== null) path.push(endIdx);

  // 2-opt: invierte segmentos mientras acorte el camino. El origen (posición
  // 0) y, si existe, el punto de retorno (última posición) quedan siempre
  // fijos — el rango que se reordena es siempre 1..n.
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n; i++) {
      for (let k = i + 1; k <= n; k++) {
        const a = path[i - 1];
        const b = path[i];
        const c = path[k];
        const d = k + 1 <= n ? path[k + 1] : endIdx;
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

  // Traducir a índices de `stops` (restar el origen); se descarta la
  // posición del punto de retorno del resultado — no es una parada, el
  // llamador lo agrega aparte.
  return path.slice(1, n + 1).map((p) => p - 1);
}
```

Replace the full body of `pathLengthKm`:

```ts
export function pathLengthKm(
  origin: LatLng,
  orderedStops: LatLng[],
  fixedEnd?: LatLng,
): number {
  let total = 0;
  let prev = origin;
  for (const stop of orderedStops) {
    total += haversineKm(prev, stop);
    prev = stop;
  }
  if (fixedEnd) total += haversineKm(prev, fixedEnd);
  return total;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run src/lib/tsp.test.ts`
Expected: PASS — all tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tsp.ts src/lib/tsp.test.ts
git commit -m "$(cat <<'EOF'
Añade soporte de punto de retorno fijo a optimizeOrder/pathLengthKm

El vecino-más-cercano y el 2-opt ahora pueden fijar tanto el origen
como un punto final (el punto de retorno), reordenando solo las
paradas intermedias.
EOF
)"
```

---

### Task 2: `routing.ts` — punto de retorno en OSRM y Mapbox

**Files:**
- Modify: `src/lib/routing.ts`
- Test: `src/lib/routing.test.ts` (new)

**Interfaces:**
- Consumes: `optimizeOrder(origin, stops, fixedEnd?)` from Task 1.
- Produces: `TripResult.returnLegKm?: number` (distance in km of the final leg to the return point, `undefined` when no return point was requested). `tripThroughStreets(origin, stops, opts: { timeoutMs?, mode?, returnPoint?: LatLng })`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/routing.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LatLng } from "./geo";
import { tripThroughStreets } from "./routing";

const origin: LatLng = { lat: 4.6, lng: -74.08 };
const stops: LatLng[] = [
  { lat: 4.61, lng: -74.08 },
  { lat: 4.62, lng: -74.08 },
];
const returnPoint: LatLng = { lat: 4.55, lng: -74.03 };

function osrmResponse(waypointOrder: number[], legDistancesM: number[]) {
  return {
    code: "Ok",
    trips: [
      {
        distance: legDistancesM.reduce((a, b) => a + b, 0),
        duration: 600,
        geometry: { coordinates: [[-74.08, 4.6]] },
        legs: legDistancesM.map((distance) => ({ distance, duration: 60 })),
      },
    ],
    waypoints: waypointOrder.map((waypoint_index) => ({ waypoint_index })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tripThroughStreets — punto de retorno", () => {
  it("agrega el punto de retorno como última coordenada y pide destination=last", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        // orden del viaje: origen(0), parada1(1), parada2(2), retorno(3)
        return {
          ok: true,
          json: async () => osrmResponse([0, 1, 2, 3], [1000, 1000, 2000]),
        };
      }),
    );

    const result = await tripThroughStreets(origin, stops, { returnPoint });

    expect(capturedUrl).toContain("destination=last");
    expect(capturedUrl.split(";").length).toBe(4);
    expect(capturedUrl).toContain(`${returnPoint.lng},${returnPoint.lat}`);
    expect(result?.returnLegKm).toBeCloseTo(2, 6);
    expect(result?.legsKm).toEqual([1, 1]);
  });

  it("sin punto de retorno, pide destination=any y no agrega tramo extra", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return { ok: true, json: async () => osrmResponse([0, 1, 2], [1000, 1000]) };
      }),
    );

    const result = await tripThroughStreets(origin, stops);

    expect(capturedUrl).toContain("destination=any");
    expect(capturedUrl.split(";").length).toBe(3);
    expect(result?.returnLegKm).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run src/lib/routing.test.ts`
Expected: FAIL — `opts.returnPoint` doesn't exist on the current type / URL never contains `destination=` at all.

- [ ] **Step 3: Implement `returnPoint` threading**

In `src/lib/routing.ts`, replace the `TripResult` interface:

```ts
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
  /** Km del tramo final hasta el punto de retorno, si se pidió uno */
  returnLegKm?: number;
}
```

Replace `tryBase`'s signature and body:

```ts
async function tryBase(
  base: string,
  origin: LatLng,
  stops: LatLng[],
  timeoutMs: number,
  profile: string,
  returnPoint?: LatLng,
): Promise<TripResult | null> {
  const allPoints = returnPoint ? [origin, ...stops, returnPoint] : [origin, ...stops];
  const coords = allPoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const destination = returnPoint ? "last" : "any";
  const url =
    `${base}/trip/v1/${profile}/${coords}` +
    `?roundtrip=false&source=first&destination=${destination}&geometries=geojson&overview=full`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null; // servidor limitado/caído → prueba el siguiente

    const data = (await res.json()) as OsrmTripResponse;
    const trip = data.trips?.[0];
    if (data.code !== "Ok" || !trip || !data.waypoints) return null;

    // waypoints[i].waypoint_index = posición de la coordenada i en el viaje
    // (i=0 es el origen; i=1..n son las paradas; si hay punto de retorno,
    // i=n+1 es su coordenada, y con destination=last siempre es la última)
    const positions = data.waypoints.map((w) => w.waypoint_index);
    const order = stops
      .map((_, i) => i)
      .sort((a, b) => positions[a + 1] - positions[b + 1]);
    // El tramo que LLEGA a la parada en posición p del viaje es legs[p-1]
    const legsKm = order.map((stopIdx) => {
      const leg = trip.legs[positions[stopIdx + 1] - 1];
      return leg ? leg.distance / 1000 : 0;
    });
    const returnLegKm = returnPoint
      ? trip.legs[trip.legs.length - 1].distance / 1000
      : undefined;

    return {
      order,
      legsKm,
      distanceKm: trip.distance / 1000,
      durationMin: trip.duration / 60,
      coordinates: trip.geometry.coordinates,
      source: base,
      returnLegKm,
    };
  } catch {
    return null; // red caída, CORS, timeout → prueba el siguiente servidor
  } finally {
    clearTimeout(timer);
  }
}
```

Replace `tripMapbox`'s signature and body:

```ts
async function tripMapbox(
  origin: LatLng,
  stops: LatLng[],
  timeoutMs: number,
  profile: string,
  returnPoint?: LatLng,
): Promise<TripResult | null> {
  if (!MAPBOX_KEY) return null;
  const order = optimizeOrder(origin, stops, returnPoint);
  const sequence = returnPoint
    ? [origin, ...order.map((i) => stops[i]), returnPoint]
    : [origin, ...order.map((i) => stops[i])];
  const coords = sequence.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?access_token=${MAPBOX_KEY}&geometries=geojson&overview=full&annotations=congestion,traffic`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as MapboxResponse;
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return null;

    const legsKm = route.legs.map((l) => l.distance / 1000);
    const returnLegKm = returnPoint ? legsKm[legsKm.length - 1] : undefined;

    return {
      order,
      // Sin punto de retorno, un leg por parada. Con punto de retorno, el
      // último leg es el tramo hasta él — se expone aparte, no en legsKm.
      legsKm: returnPoint ? legsKm.slice(0, -1) : legsKm,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      coordinates: route.geometry.coordinates,
      source: "mapbox",
      withTraffic: true,
      returnLegKm,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

Replace `tripThroughStreets`:

```ts
export async function tripThroughStreets(
  origin: LatLng,
  stops: LatLng[],
  opts: { timeoutMs?: number; mode?: TransportMode; returnPoint?: LatLng } = {},
): Promise<TripResult | null> {
  const { timeoutMs = 12000, mode = "car", returnPoint } = opts;
  if (stops.length === 0) return null;

  const profile = OSRM_PROFILE[mode];

  if (ROUTING_PROVIDER === "mapbox") {
    const viaMapbox = await tripMapbox(
      origin,
      stops,
      timeoutMs,
      MAPBOX_PROFILE[mode],
      returnPoint,
    );
    if (viaMapbox) return viaMapbox;
    // Sin llave válida o fallo → cae a OSRM gratis
  }

  for (const base of osrmBasesFor(mode)) {
    const result = await tryBase(base, origin, stops, timeoutMs, profile, returnPoint);
    if (result) return result;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run src/lib/routing.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routing.ts src/lib/routing.test.ts
git commit -m "$(cat <<'EOF'
Añade punto de retorno opcional a tripThroughStreets (OSRM + Mapbox)

OSRM recibe la coordenada extra con destination=last; Mapbox la
agrega como último elemento de la secuencia ya optimizada. El tramo
final se expone aparte en TripResult.returnLegKm, sin alterar el
mapeo legsKm[i] ↔ stops[order[i]] que ya usa RoadList.
EOF
)"
```

---

### Task 3: Capa de almacenamiento — puntos de retorno guardados

**Files:**
- Modify: `src/lib/historyDb.ts`
- Create: `src/state/returnPointsStore.ts`

**Interfaces:**
- Produces: `SavedReturnPoint { id, label, lat, lng, createdAt, updatedAt }`; `putReturnPoint(point): Promise<void>`; `deleteReturnPoint(id): Promise<void>`; `listReturnPoints(): Promise<SavedReturnPoint[]>` (sorted by `label`). `RouteHistoryRecord.returnPoint?: { lat, lng, label } | null`. `useReturnPointsStore` — Zustand store with `{ points, refresh, save, remove }`.

- [ ] **Step 1: Bump the DB version and add the new object store**

In `src/lib/historyDb.ts`, change:

```ts
const DB_NAME = "rutafacil-history";
const DB_VERSION = 1;
const STORE = "routes";
```

to:

```ts
const DB_NAME = "rutafacil-history";
const DB_VERSION = 2;
const STORE = "routes";
const RETURN_POINTS_STORE = "returnPoints";
```

Replace `openDb`'s `onupgradeneeded`:

```ts
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(RETURN_POINTS_STORE)) {
        db.createObjectStore(RETURN_POINTS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 2: Add the `returnPoint` field to `RouteHistoryRecord`**

In the `RouteHistoryRecord` interface, right after the existing `origin?: { lat: number; lng: number } | null;` line, add:

```ts
  /** Punto de retorno usado al momento de guardar este registro, si tenía uno. */
  returnPoint?: { lat: number; lng: number; label: string } | null;
```

- [ ] **Step 3: Add `SavedReturnPoint` and the CRUD functions**

Add after the `deleteRoute` function in `src/lib/historyDb.ts`:

```ts
export interface SavedReturnPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  createdAt: number;
  updatedAt: number;
}

/** Crea o reemplaza un punto de retorno guardado. */
export async function putReturnPoint(point: SavedReturnPoint): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RETURN_POINTS_STORE, "readwrite");
    tx.objectStore(RETURN_POINTS_STORE).put(point);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteReturnPoint(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RETURN_POINTS_STORE, "readwrite");
    tx.objectStore(RETURN_POINTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Todos los puntos de retorno guardados, ordenados alfabéticamente. */
export async function listReturnPoints(): Promise<SavedReturnPoint[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RETURN_POINTS_STORE, "readonly");
    const req = tx.objectStore(RETURN_POINTS_STORE).getAll();
    req.onsuccess = () => {
      const points = (req.result as SavedReturnPoint[]).sort((a, b) =>
        a.label.localeCompare(b.label),
      );
      resolve(points);
    };
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Create the Zustand wrapper store**

Create `src/state/returnPointsStore.ts`:

```ts
import { create } from "zustand";
import {
  deleteReturnPoint,
  listReturnPoints,
  putReturnPoint,
  type SavedReturnPoint,
} from "../lib/historyDb";

interface ReturnPointsState {
  points: SavedReturnPoint[];
  refresh: () => Promise<void>;
  save: (point: SavedReturnPoint) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useReturnPointsStore = create<ReturnPointsState>((set, get) => ({
  points: [],

  refresh: async () => {
    const points = await listReturnPoints();
    set({ points });
  },

  save: async (point) => {
    await putReturnPoint(point);
    await get().refresh();
  },

  remove: async (id) => {
    await deleteReturnPoint(id);
    await get().refresh();
  },
}));
```

- [ ] **Step 6: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual verification of the storage layer**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npm run dev` (leave running), open the printed local URL in a browser, open DevTools → Console, and run:

```js
const req = indexedDB.open("rutafacil-history");
req.onsuccess = () => {
  const db = req.result;
  console.log("version", db.version); // expect 2
  console.log("stores", [...db.objectStoreNames]); // expect ["routes", "returnPoints"]
  const tx = db.transaction("returnPoints", "readwrite");
  tx.objectStore("returnPoints").put({ id: "t1", label: "Bodega", lat: 4.6, lng: -74.08, createdAt: Date.now(), updatedAt: Date.now() });
  tx.oncomplete = () => {
    db.transaction("returnPoints").objectStore("returnPoints").getAll().onsuccess = (e) => console.log("points", e.target.result);
  };
};
```

Expected console output: `version 2`, `stores ["routes", "returnPoints"]`, and `points` containing the `{ id: "t1", label: "Bodega", ... }` record. Stop the dev server (Ctrl+C) when confirmed.

- [ ] **Step 8: Commit**

```bash
git add src/lib/historyDb.ts src/state/returnPointsStore.ts
git commit -m "$(cat <<'EOF'
Añade almacenamiento de puntos de retorno guardados en IndexedDB

Nuevo object store "returnPoints" (DB_VERSION 2) con CRUD básico y
un store de Zustand (returnPointsStore) que lo expone de forma
reactiva. RouteHistoryRecord gana un campo returnPoint? opcional,
mismo patrón que origin?, para que el historial pueda mostrar qué
punto se usó en cada ruta guardada.
EOF
)"
```

---

### Task 4: `routeStore.ts` — punto de retorno de la ruta activa

**Files:**
- Modify: `src/state/routeStore.ts`

**Interfaces:**
- Consumes: `optimizeOrder(origin, stops, fixedEnd?)` and `tripThroughStreets(origin, stops, { returnPoint? })` from Tasks 1–2.
- Produces: `RouteState.returnPoint: { id: string; label: string; lat: number; lng: number } | null`; `RouteState.returnLegKm: number | null`; `RouteState.setReturnPoint(point): void`. `OptimizationResult.returnLegKm?: number | null`.

- [ ] **Step 1: Add the new state fields and action to the `RouteState` interface**

In `src/state/routeStore.ts`, add to `OptimizationResult`:

```ts
export interface OptimizationResult {
  ordered: Stop[];
  origin: LatLng;
  km: number;
  durationMin: number | null;
  geometry: [number, number][] | null;
  byStreets: boolean;
  returnLegKm?: number | null;
}
```

Add to `RouteState`, right after `origin: LatLng | null;`:

```ts
  /** Punto de retorno asignado a la ruta activa (copia, no una referencia:
   * si el punto guardado se borra o renombra después, la ruta activa y el
   * historial ya escrito conservan el nombre/ubicación que tenían). */
  returnPoint: { id: string; label: string; lat: number; lng: number } | null;
  /** Km del tramo final hasta el punto de retorno, una vez optimizada la
   * ruta; null si no hay punto de retorno o aún no se ha optimizado. */
  returnLegKm: number | null;
```

Add to the actions block of the interface, right after `clearRoute: () => void;`:

```ts
  setReturnPoint: (
    point: { id: string; label: string; lat: number; lng: number } | null,
  ) => void;
```

- [ ] **Step 2: Update `invalidated`, initial state, `syncHistory`, and `clearRoute`**

Replace the `invalidated` constant:

```ts
const invalidated = {
  optimizedKm: null,
  durationMin: null,
  geometry: null,
  returnLegKm: null,
} as const;
```

In `syncHistory`, add `returnPoint: s.returnPoint,` right after `origin: s.origin,` in the `record` object.

In the store's initial state (inside `create<RouteState>()(persist((set, get) => ({ ... }))`), add right after `origin: null,`:

```ts
      returnPoint: null,
      returnLegKm: null,
```

In `clearRoute`, add `returnPoint: null,` right after `origin: null,` in the `set({...})` call.

- [ ] **Step 3: Implement `setReturnPoint`**

Add the action right after `clearRoute` in the store body:

```ts
      setReturnPoint: (point) => {
        set({ returnPoint: point, ...invalidated });
        syncHistory(get());
      },
```

- [ ] **Step 4: Thread `returnPoint`/`returnLegKm` through `setMode` and `applyOptimization`**

Replace `setMode`'s body:

```ts
      setMode: async (mode) => {
        const { origin, stops, returnPoint } = get();
        const pending = stops.filter((s) => !s.delivered);
        const version = get().beginRouteRequest();
        set({ mode, ...invalidated });
        // Si ya había ruta optimizada, la recalcula para el nuevo vehículo
        if (!origin || pending.length < 1) return;

        const trip = await withLoader(() =>
          tripThroughStreets(origin, pending, {
            mode,
            returnPoint: returnPoint ?? undefined,
          }),
        );
        if (trip) {
          const ordered = trip.order.map((i, idx) => ({
            ...pending[i],
            legKm: trip.legsKm[idx],
          }));
          get().applyOptimization(
            {
              ordered,
              origin,
              km: trip.distanceKm,
              durationMin: trip.durationMin,
              geometry: trip.coordinates,
              byStreets: true,
              returnLegKm: trip.returnLegKm ?? null,
            },
            version,
          );
          return;
        }

        // El servicio de rutas falló para este vehículo (servidor caído,
        // perfil no disponible, sin conexión): respaldo en línea recta en
        // vez de dejar la app sin ruta actualizada.
        if (version !== get().routeVersion) return; // ya hay algo más reciente
        const order = optimizeOrder(origin, pending, returnPoint ?? undefined);
        let prev: LatLng = origin;
        const ordered = order.map((i) => {
          const stop = { ...pending[i], legKm: haversineKm(prev, pending[i]) };
          prev = stop;
          return stop;
        });
        let km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
        let returnLegKm: number | null = null;
        if (returnPoint) {
          returnLegKm = haversineKm(prev, returnPoint);
          km += returnLegKm;
        }
        get().applyOptimization(
          { ordered, origin, km, durationMin: null, geometry: null, byStreets: false, returnLegKm },
          version,
        );
        toast(
          "Sin conexión al servicio de rutas para este vehículo: orden calculado en línea recta.",
          {
            icon: createElement(AlertIcon, { width: 18, height: 18 }),
            className: "rht rht--error",
          },
        );
      },
```

Replace `applyOptimization`'s body:

```ts
      applyOptimization: (
        { ordered, origin, km, durationMin, geometry, byStreets, returnLegKm },
        version,
      ) => {
        // Resultado de una solicitud ya superada por otra más reciente: se
        // descarta para no pisar el cálculo vigente con uno atrasado.
        if (version !== undefined && version !== get().routeVersion) return;
        // Las entregadas quedan al frente (ya pasaste por ahí)
        const done = get().stops.filter((s) => s.delivered);
        set({
          stops: [...done, ...ordered],
          origin,
          optimizedKm: km,
          durationMin,
          geometry,
          byStreets,
          returnLegKm: returnLegKm ?? null,
        });
        syncHistory(get());
      },
```

- [ ] **Step 5: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors. `OptimizationResult.returnLegKm` is optional, so the existing `applyOptimization` calls in `OptimizeBar.tsx`/`LiveTracker.tsx` (not yet updated — that's Task 5) keep compiling as-is until Task 5 adds the field to them too.

- [ ] **Step 6: Commit**

```bash
git add src/state/routeStore.ts
git commit -m "$(cat <<'EOF'
Añade returnPoint/returnLegKm a la ruta activa (routeStore)

setReturnPoint asigna (o quita) el punto de retorno de la ruta en
curso e invalida el cálculo vigente, igual que addStop/removeStop.
setMode ahora reoptimiza pasando el punto de retorno tanto al
servicio de rutas como al respaldo en línea recta.
EOF
)"
```

---

### Task 5: Pasar el punto de retorno al optimizar y al recalcular en vivo

**Files:**
- Modify: `src/components/OptimizeBar.tsx`
- Modify: `src/components/LiveTracker.tsx`

**Interfaces:**
- Consumes: `RouteState.returnPoint`/`returnLegKm` and the extended `tripThroughStreets`/`optimizeOrder` from Tasks 1, 2 and 4.

- [ ] **Step 1: Read `returnPoint` in `OptimizeBar` and thread it through `handleOptimize`**

In `src/components/OptimizeBar.tsx`, add alongside the other `useRouteStore` reads (after `const optimizedKm = useRouteStore((s) => s.optimizedKm);`):

```ts
  const returnPoint = useRouteStore((s) => s.returnPoint);
```

Replace the body of `handleOptimize`'s inner `withLoader(async () => { ... })` callback (the whole block from `let origin: LatLng | null = null;` to the closing `}` before `});`):

```ts
      let origin: LatLng | null = null;
      try {
        origin = await getPosition();
      } catch {
        onNotify(
          (await geolocationDenied())
            ? "La ubicación está bloqueada para RutaFácil. Actívala: toca el candado en la barra de direcciones (o mantén presionado el ícono de la app → Información → Permisos) → Ubicación → Permitir."
            : "No pude obtener tu ubicación (¿GPS apagado?). La ruta parte de la primera parada.",
          true,
        );
      }
      const effectiveOrigin = origin ?? pending[0];
      const returnLatLng = returnPoint ?? undefined;

      // Primero por calles reales (OSRM); si no hay conexión, línea recta
      const trip = await tripThroughStreets(effectiveOrigin, pending, {
        mode,
        returnPoint: returnLatLng,
      });
      if (trip) {
        const ordered: Stop[] = trip.order.map((stopIdx, i) => ({
          ...pending[stopIdx],
          legKm: trip.legsKm[i],
        }));
        applyOptimization(
          {
            ordered,
            origin: effectiveOrigin,
            km: trip.distanceKm,
            durationMin: trip.durationMin,
            geometry: trip.coordinates,
            byStreets: true,
            returnLegKm: trip.returnLegKm ?? null,
          },
          version,
        );
        onNotify(
          `Ruta por calles armada: ${trip.distanceKm.toFixed(1)} km, ~${Math.round(trip.durationMin)} min ${origin ? "desde tu ubicación" : "desde la primera parada"}`,
        );
      } else {
        const order = optimizeOrder(effectiveOrigin, pending, returnLatLng);
        let prev: LatLng = effectiveOrigin;
        const ordered: Stop[] = order.map((i) => {
          const stop = { ...pending[i], legKm: haversineKm(prev, pending[i]) };
          prev = stop;
          return stop;
        });
        let km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
        let returnLegKm: number | null = null;
        if (returnLatLng) {
          returnLegKm = haversineKm(prev, returnLatLng);
          km += returnLegKm;
        }
        applyOptimization(
          {
            ordered,
            origin: effectiveOrigin,
            km,
            durationMin: null,
            geometry: null,
            byStreets: false,
            returnLegKm,
          },
          version,
        );
        onNotify(
          "Sin conexión al servicio de rutas: orden calculado en línea recta. Vuelve a tocar Armar ruta cuando tengas señal.",
          true,
        );
      }
```

Note: the `mode` variable already exists in scope (destructured from `useRouteStore` at the top of the component) — the original code passed `{ mode }` to `tripThroughStreets`; this replacement keeps that and adds `returnPoint`.

- [ ] **Step 2: Thread `returnPoint` through `LiveTracker`'s reroute**

In `src/components/LiveTracker.tsx`, replace the `reroute` function:

```ts
async function reroute(pending: Stop[], from: LatLng) {
  const { mode, returnPoint } = useRouteStore.getState();
  const version = useRouteStore.getState().beginRouteRequest();
  const trip = await withLoader(() =>
    tripThroughStreets(from, pending, { mode, returnPoint: returnPoint ?? undefined }),
  );
  if (!trip) return;
  const ordered = trip.order.map((i, idx) => ({
    ...pending[i],
    legKm: trip.legsKm[idx],
  }));
  useRouteStore.getState().applyOptimization(
    {
      ordered,
      origin: from,
      km: trip.distanceKm,
      durationMin: trip.durationMin,
      geometry: trip.coordinates,
      byStreets: true,
      returnLegKm: trip.returnLegKm ?? null,
    },
    version,
  );
  toast("Ruta recalculada desde tu posición", {
    icon: <CheckIcon width={18} height={18} />,
    className: "rht",
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run`
Expected: PASS (no test touches these components directly, but this confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add src/components/OptimizeBar.tsx src/components/LiveTracker.tsx
git commit -m "$(cat <<'EOF'
Pasa el punto de retorno al optimizar y al recalcular en vivo

OptimizeBar y LiveTracker ahora reenvían routeStore.returnPoint tanto
al servicio de rutas (OSRM/Mapbox) como al respaldo en línea recta,
para que el punto de retorno siga siendo el último nodo del
recorrido incluso tras un recálculo por desvío.
EOF
)"
```

---

### Task 6: Iconos nuevos (pin y más)

**Files:**
- Modify: `src/components/icons.tsx`

**Interfaces:**
- Produces: `PinIcon` (componente de icono), `PlusIcon` (componente de icono), `PIN_SVG_MARKUP: string` (markup estático para marcadores de MapLibre, igual que `CHECK_SVG_MARKUP`).

- [ ] **Step 1: Add the new icon exports**

In `src/components/icons.tsx`, add `FaMapPin` and `FaPlus` to the import from `react-icons/fa6`:

```ts
import {
  FaCar,
  FaMotorcycle,
  FaBicycle,
  FaPersonWalking,
  FaCheck,
  FaTriangleExclamation,
  FaXmark,
  FaArrowRight,
  FaMapPin,
  FaPlus,
} from "react-icons/fa6";
```

Add after `export const ArrowRightIcon = FaArrowRight;`:

```ts
export const PinIcon = FaMapPin;
export const PlusIcon = FaPlus;
```

Add after `export const CHECK_SVG_MARKUP = ...;`:

```ts
/** Markup estático del pin de punto de retorno, para el marcador de mapa
 * creado fuera de React (MapLibre construye esos elementos de forma
 * imperativa, sin árbol de React). */
export const PIN_SVG_MARKUP = renderToStaticMarkup(
  createElement(FaMapPin, { size: 14 }),
);
```

- [ ] **Step 2: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/icons.tsx
git commit -m "Añade PinIcon/PlusIcon y su markup estático para el punto de retorno"
```

---

### Task 7: `MapPointPicker` — elegir un punto tocando el mapa

**Files:**
- Create: `src/components/MapPointPicker.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `PinIcon` from Task 6, `LatLng` from `src/lib/geo.ts`.
- Produces: `MapPointPicker({ initial?: LatLng, onConfirm: (point: LatLng) => void, onCancel: () => void })` — a full-panel map with a pin fixed at screen-center; moving the map moves the "selected point"; confirming reads `map.getCenter()`.

- [ ] **Step 1: Create the component**

Create `src/components/MapPointPicker.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "../lib/geo";
import { PinIcon } from "./icons";

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
};

/** Selector de ubicación: el mapa se mueve, el pin queda fijo en el centro
 * de la pantalla. Al confirmar se lee el centro actual del mapa — evita
 * tener que implementar detección de clics/hit-testing sobre el mapa. */
export function MapPointPicker({
  initial,
  onConfirm,
  onCancel,
}: {
  initial?: LatLng;
  onConfirm: (point: LatLng) => void;
  onCancel: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const centerRef = useRef<LatLng>(initial ?? { lat: 4.6, lng: -74.08 });
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const start = centerRef.current;
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: [start.lng, start.lat],
      zoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const onMove = () => {
      const c = map.getCenter();
      centerRef.current = { lat: c.lat, lng: c.lng };
      forceRender((n) => n + 1);
    };
    map.on("move", onMove);
    return () => {
      map.off("move", onMove);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="point-picker">
      <div className="point-picker__map" ref={container} />
      <div className="point-picker__pin" aria-hidden="true">
        <PinIcon size={30} />
      </div>
      <div className="point-picker__coords">
        {centerRef.current.lat.toFixed(5)}, {centerRef.current.lng.toFixed(5)}
      </div>
      <div className="point-picker__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-nav"
          onClick={() => onConfirm(centerRef.current)}
        >
          Usar este punto
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add its CSS**

Add to `src/styles/global.css`, after the `.history-detail__stop-km` rule (end of the "Detalle de una ruta guardada" section):

```css
/* ============ Selector de punto en el mapa ============ */
.point-picker {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  background: var(--pavimento);
}

.point-picker__map {
  flex: 1;
  position: relative;
}

.point-picker__pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  color: var(--cono);
  pointer-events: none;
  filter: drop-shadow(0 2px 3px rgba(33, 30, 26, 0.5));
}

.point-picker__coords {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--asfalto);
  color: var(--pintura-blanca);
  font-family: var(--font-data);
  font-size: 0.75rem;
  padding: 6px 12px;
  border-radius: 999px;
}

.point-picker__actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--asfalto);
}

.point-picker__actions .btn {
  flex: 1;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapPointPicker.tsx src/styles/global.css
git commit -m "Añade MapPointPicker: elegir un punto arrastrando el mapa bajo un pin fijo"
```

---

### Task 8: `ReturnPointForm` — crear un punto de retorno

**Files:**
- Create: `src/components/ReturnPointForm.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `MapPointPicker` (Task 7), `parseSharedText` from `src/lib/parse.ts`, `resolveShortLink` from `src/lib/resolve.ts`.
- Produces: `ReturnPointForm({ onSave: (input: { label: string; lat: number; lng: number }) => void, onCancel: () => void, onNotify: (text, error?) => void })`.

- [ ] **Step 1: Create the component**

Create `src/components/ReturnPointForm.tsx`:

```tsx
import { useState } from "react";
import { parseSharedText } from "../lib/parse";
import { resolveShortLink } from "../lib/resolve";
import type { LatLng } from "../lib/geo";
import { MapPointPicker } from "./MapPointPicker";

export function ReturnPointForm({
  onSave,
  onCancel,
  onNotify,
}: {
  onSave: (input: { label: string; lat: number; lng: number }) => void;
  onCancel: () => void;
  onNotify: (text: string, error?: boolean) => void;
}) {
  const [label, setLabel] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [picked, setPicked] = useState<LatLng | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolveFromPaste = async () => {
    setBusy(true);
    try {
      const text = pasteText.trim();
      if (!text) {
        onNotify("Pega un enlace de Maps o coordenadas.", true);
        return;
      }
      let result = parseSharedText(text);
      if (result.kind === "short-link") {
        const finalUrl = await resolveShortLink(result.url);
        result = finalUrl ? parseSharedText(finalUrl) : { kind: "none" };
      }
      if (result.kind !== "ok") {
        onNotify("No encontré ninguna ubicación en ese texto.", true);
        return;
      }
      setPicked({ lat: result.lat, lng: result.lng });
      if (!label && result.label) setLabel(result.label);
      onNotify("Ubicación encontrada");
    } finally {
      setBusy(false);
    }
  };

  const confirmSave = () => {
    if (!picked) {
      onNotify("Primero define la ubicación: pega un enlace o toca el mapa.", true);
      return;
    }
    const finalLabel = label.trim() || "Punto de retorno";
    onSave({ label: finalLabel, lat: picked.lat, lng: picked.lng });
  };

  if (showMapPicker) {
    return (
      <MapPointPicker
        initial={picked ?? undefined}
        onConfirm={(point) => {
          setPicked(point);
          setShowMapPicker(false);
        }}
        onCancel={() => setShowMapPicker(false)}
      />
    );
  }

  return (
    <div className="return-point-form">
      <label className="return-point-form__field">
        Nombre
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej. Bodega"
          aria-label="Nombre del punto de retorno"
        />
      </label>

      <div className="return-point-form__field">
        <span>Ubicación</span>
        <p
          className={`return-point-form__picked${picked ? "" : " return-point-form__picked--empty"}`}
        >
          {picked ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : "Sin definir todavía"}
        </p>
        <textarea
          rows={1}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Pega un enlace de Maps o coordenadas"
          aria-label="Pega un enlace de Maps o coordenadas para el punto de retorno"
          disabled={busy}
        />
        <div className="return-point-form__actions-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void resolveFromPaste()}
            disabled={busy}
          >
            Usar enlace pegado
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowMapPicker(true)}>
            Tocar en el mapa
          </button>
        </div>
      </div>

      <div className="return-point-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn btn-nav" onClick={confirmSave}>
          Guardar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add its CSS**

Add to `src/styles/global.css`, right after the `.point-picker__actions .btn` rule from Task 7:

```css
/* ============ Formulario de punto de retorno ============ */
.return-point-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.return-point-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--font-data);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tinta-suave);
}

.return-point-form__field input,
.return-point-form__field textarea {
  font-family: var(--font-body);
  font-size: 0.95rem;
  text-transform: none;
  letter-spacing: normal;
  border: var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  background: var(--pintura-blanca);
  color: var(--asfalto);
  resize: none;
}

.return-point-form__picked {
  margin: 0;
  font-family: var(--font-data);
  font-size: 0.85rem;
  color: var(--asfalto);
}

.return-point-form__picked--empty {
  color: var(--tinta-suave);
}

.return-point-form__actions-row {
  display: flex;
  gap: 8px;
}

.return-point-form__actions-row .btn {
  flex: 1;
}

.return-point-form__actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.return-point-form__actions .btn {
  flex: 1;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReturnPointForm.tsx src/styles/global.css
git commit -m "Añade ReturnPointForm: crear un punto de retorno pegando un enlace o tocando el mapa"
```

---

### Task 9: `ReturnPointSheet` — elegir/gestionar puntos guardados, montada en la app

**Files:**
- Create: `src/components/ReturnPointSheet.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `useReturnPointsStore` (Task 3), `useRouteStore.returnPoint`/`setReturnPoint` (Task 4), `ReturnPointForm` (Task 8), `PinIcon`/`PlusIcon`/`CloseIcon` (Task 6 + existing `icons.tsx`).
- Produces: `ReturnPointTrigger({ onNotify })` — the button mounted next to `AddStop`; exported as the only public piece (the sheet itself is internal).

- [ ] **Step 1: Create the component**

Create `src/components/ReturnPointSheet.tsx`:

```tsx
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useReturnPointsStore } from "../state/returnPointsStore";
import { useRouteStore } from "../state/routeStore";
import type { SavedReturnPoint } from "../lib/historyDb";
import { CloseIcon, PinIcon, PlusIcon } from "./icons";
import { ReturnPointForm } from "./ReturnPointForm";

let counter = 0;
const newId = () => `retpt-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function ReturnPointTrigger({
  onNotify,
}: {
  onNotify: (text: string, error?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const returnPoint = useRouteStore((s) => s.returnPoint);

  return (
    <>
      <button
        className="return-point-trigger"
        onClick={() => setOpen(true)}
        aria-label={
          returnPoint ? `Punto de retorno: ${returnPoint.label}` : "Añadir punto de retorno"
        }
      >
        <PinIcon size={13} />
        {returnPoint ? returnPoint.label : "Punto de retorno"}
      </button>
      {open && <ReturnPointSheet onClose={() => setOpen(false)} onNotify={onNotify} />}
    </>
  );
}

function ReturnPointSheet({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify: (text: string, error?: boolean) => void;
}) {
  const points = useReturnPointsStore((s) => s.points);
  const refresh = useReturnPointsStore((s) => s.refresh);
  const save = useReturnPointsStore((s) => s.save);
  const remove = useReturnPointsStore((s) => s.remove);
  const returnPoint = useRouteStore((s) => s.returnPoint);
  const setReturnPoint = useRouteStore((s) => s.setReturnPoint);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void refresh().then(() => setLoaded(true));
  }, [refresh]);

  useEffect(() => {
    if (loaded && !creating && points.length === 0) setCreating(true);
  }, [loaded, creating, points.length]);

  const handleUse = (point: SavedReturnPoint) => {
    setReturnPoint({ id: point.id, label: point.label, lat: point.lat, lng: point.lng });
    onNotify(`Punto de retorno: ${point.label}`);
    onClose();
  };

  const handleDelete = (point: SavedReturnPoint) => {
    toast(
      (t) => (
        <div className="confirm-modal" role="alertdialog" aria-label="Eliminar punto de retorno">
          <p className="confirm-modal__text">
            ¿Eliminar &ldquo;{point.label}&rdquo;? No se puede deshacer.
          </p>
          <div className="confirm-modal__actions">
            <button
              className="btn btn--danger"
              onClick={() => {
                toast.dismiss(t.id);
                void remove(point.id);
                if (returnPoint?.id === point.id) setReturnPoint(null);
              }}
            >
              Eliminar
            </button>
            <button className="btn btn--ghost" onClick={() => toast.dismiss(t.id)}>
              Cancelar
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, className: "confirm-toast" },
    );
  };

  const handleSave = async (input: { label: string; lat: number; lng: number }) => {
    const now = Date.now();
    const point: SavedReturnPoint = { id: newId(), ...input, createdAt: now, updatedAt: now };
    await save(point);
    setReturnPoint({ id: point.id, label: point.label, lat: point.lat, lng: point.lng });
    onNotify(`Punto de retorno "${point.label}" guardado`);
    onClose();
  };

  return (
    <div
      className="history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Punto de retorno"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="history-panel">
        <div className="history-panel__header">
          <h2>Punto de retorno</h2>
          <button className="history-close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {creating ? (
          <ReturnPointForm
            onSave={(input) => void handleSave(input)}
            onCancel={() => (points.length === 0 ? onClose() : setCreating(false))}
            onNotify={onNotify}
          />
        ) : (
          <>
            <ul className="return-point-list">
              {points.map((point) => (
                <li key={point.id} className="return-point-list__item">
                  <button className="return-point-list__use" onClick={() => handleUse(point)}>
                    {point.label}
                  </button>
                  <button
                    className="history-icon-btn history-icon-btn--danger"
                    onClick={() => handleDelete(point)}
                    aria-label={`Eliminar ${point.label}`}
                  >
                    <CloseIcon width={13} height={13} />
                  </button>
                </li>
              ))}
            </ul>
            {returnPoint && (
              <button
                className="return-point-remove"
                onClick={() => {
                  setReturnPoint(null);
                  onNotify("Punto de retorno quitado de esta ruta");
                  onClose();
                }}
              >
                Quitar de esta ruta
              </button>
            )}
            <button className="return-point-new" onClick={() => setCreating(true)}>
              <PlusIcon width={14} height={14} />
              Nuevo punto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the trigger in `App.tsx`**

In `src/App.tsx`, add the import right after the `AddStop` import:

```ts
import { ReturnPointTrigger } from "./components/ReturnPointSheet";
```

Replace the `<AddStop onSubmit={ingest} onNotify={notify} />` line with:

```tsx
      <AddStop onSubmit={ingest} onNotify={notify} />
      <ReturnPointTrigger onNotify={notify} />
```

- [ ] **Step 3: Add the CSS**

Add to `src/styles/global.css`, right after the `.return-point-form__actions .btn` rule from Task 8:

```css
/* ============ Selector/gestión de puntos de retorno ============ */
.return-point-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 16px 8px;
  border: 2px dashed var(--asfalto-claro);
  border-radius: var(--radius);
  background: transparent;
  color: var(--tinta-suave);
  font-family: var(--font-data);
  font-size: 0.78rem;
  padding: 8px 12px;
  align-self: flex-start;
}

.return-point-list {
  list-style: none;
  margin: 0;
  padding: 12px 16px 0;
  display: grid;
  gap: 8px;
}

.return-point-list__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.return-point-list__use {
  flex: 1;
  text-align: left;
  background: var(--pintura-blanca);
  border: 2px solid var(--asfalto);
  border-radius: var(--radius);
  padding: 10px 12px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--asfalto);
}

.return-point-new,
.return-point-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 8px 16px;
  border: 2px solid var(--asfalto);
  border-radius: var(--radius);
  padding: 10px 12px;
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 0.82rem;
  background: var(--pintura);
  color: var(--asfalto);
}

.return-point-remove {
  background: transparent;
  color: var(--cono);
  border-color: var(--cono);
}
```

Note: `App.tsx`'s bottom area already has 130px of bottom padding reserved on `.road-list` for the fixed `.bottom-bar`; `ReturnPointTrigger` sits above the road list (next to `AddStop`), so no extra spacing adjustments are needed there.

- [ ] **Step 4: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReturnPointSheet.tsx src/App.tsx src/styles/global.css
git commit -m "$(cat <<'EOF'
Añade ReturnPointSheet y monta su botón junto a AddStop

Hoja de selección/gestión de puntos de retorno guardados: usar uno
existente, crear uno nuevo (ReturnPointForm), borrarlo, o quitarlo de
la ruta activa sin borrar el punto guardado.
EOF
)"
```

---

### Task 10: Mostrar el punto de retorno en la ruta activa (lista + mapa)

**Files:**
- Modify: `src/components/RoadList.tsx`
- Modify: `src/components/MapView.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `RouteState.returnPoint`/`returnLegKm` (Task 4), `PinIcon`/`PIN_SVG_MARKUP` (Task 6).

- [ ] **Step 1: Render the return-point row in `RoadList`**

In `src/components/RoadList.tsx`, add the import:

```ts
import { PinIcon } from "./icons";
```

Add alongside the other `useRouteStore` reads in `RoadList`:

```ts
  const returnPoint = useRouteStore((s) => s.returnPoint);
  const returnLegKm = useRouteStore((s) => s.returnLegKm);
```

Add a new `<li>` right after the closing `</AnimatePresence>` and before the closing `</ol>`:

```tsx
      {returnPoint && (
        <li className="road-item road-return" aria-label="Punto de retorno">
          <span className="marker marker-return" aria-hidden="true">
            <PinIcon size={13} />
          </span>
          <div className="origin-chip">
            Punto de retorno · {returnPoint.label}
            {optimized && returnLegKm !== null && ` · +${returnLegKm.toFixed(1)} km`}
          </div>
        </li>
      )}
```

- [ ] **Step 2: Render the return-point marker in `MapView`**

In `src/components/MapView.tsx`, add the import:

```ts
import { CHECK_SVG_MARKUP, PIN_SVG_MARKUP } from "./icons";
```

(Replace the existing `import { CHECK_SVG_MARKUP } from "./icons";` line with the one above.)

Add alongside the other `useRouteStore` reads:

```ts
  const returnPoint = useRouteStore((s) => s.returnPoint);
```

In the markers effect, right after the `if (origin && !tracking) { ... }` block that pushes the origin marker, add:

```tsx
    if (returnPoint) {
      const el = document.createElement("div");
      el.className = "map-marker is-return";
      el.innerHTML = PIN_SVG_MARKUP;
      markersRef.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([returnPoint.lng, returnPoint.lat])
          .addTo(map),
      );
    }
```

In the same effect, right after the `if (origin && Number.isFinite(origin.lng) && Number.isFinite(origin.lat)) { bounds.extend(...) }` block inside the `fitBounds` section, add:

```tsx
      if (returnPoint && Number.isFinite(returnPoint.lng) && Number.isFinite(returnPoint.lat)) {
        bounds.extend([returnPoint.lng, returnPoint.lat]);
      }
```

Update the effect's dependency array from `[stops, origin, geometry, byStreets, tracking]` to `[stops, origin, geometry, byStreets, tracking, returnPoint]`.

- [ ] **Step 3: Add the CSS**

Add to `src/styles/global.css`, right after `.origin-chip` (in the "La carretera viva" section):

```css
.marker-return {
  background: var(--pintura-blanca);
  border-color: var(--cono);
  color: var(--cono);
  font-size: 0.65rem;
}
```

Add right after `.map-marker.is-origin` (in the "Mapa" section):

```css
.map-marker.is-return {
  background: var(--pintura-blanca);
  border-color: var(--cono);
  color: var(--cono);
  font-size: 0.65rem;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoadList.tsx src/components/MapView.tsx src/styles/global.css
git commit -m "$(cat <<'EOF'
Muestra el punto de retorno en la lista y el mapa de la ruta activa

Nueva fila al final de RoadList (visible en cuanto se asigna, sin
esperar a optimizar) y un marcador distintivo en MapView, mismo
lenguaje visual que ya usa el origen ("TÚ").
EOF
)"
```

---

### Task 11: Mostrar el punto de retorno en el historial

**Files:**
- Modify: `src/components/RouteDetailModal.tsx`
- Modify: `src/components/RouteDetailMap.tsx`

**Interfaces:**
- Consumes: `RouteHistoryRecord.returnPoint` (Task 3), `.map-marker.is-return` CSS (Task 10).

- [ ] **Step 1: Accept and draw `returnPoint` in `RouteDetailMap`**

In `src/components/RouteDetailMap.tsx`, update the props type and destructure:

```tsx
export default function RouteDetailMap({
  stops,
  geometry,
  origin,
  returnPoint,
}: {
  stops: HistoryStop[];
  geometry: [number, number][] | null | undefined;
  origin: { lat: number; lng: number } | null | undefined;
  returnPoint: { lat: number; lng: number; label: string } | null | undefined;
}) {
```

Replace the `lineCoords` computation inside `map.on("load", ...)`:

```ts
      const hasStreetGeometry = !!geometry && geometry.length > 0;
      const lineCoords: [number, number][] = hasStreetGeometry
        ? (geometry as [number, number][])
        : [
            ...(origin && Number.isFinite(origin.lng) && Number.isFinite(origin.lat)
              ? [[origin.lng, origin.lat] as [number, number]]
              : []),
            ...validStops.map((s) => [s.lng, s.lat] as [number, number]),
            ...(returnPoint && Number.isFinite(returnPoint.lng) && Number.isFinite(returnPoint.lat)
              ? [[returnPoint.lng, returnPoint.lat] as [number, number]]
              : []),
          ];
```

Right after the `if (origin && Number.isFinite(origin.lng) && Number.isFinite(origin.lat)) { ... bounds.extend(...) }` block (which draws the origin marker), add:

```ts
      if (returnPoint && Number.isFinite(returnPoint.lng) && Number.isFinite(returnPoint.lat)) {
        const el = document.createElement("div");
        el.className = "map-marker is-return";
        el.innerHTML = PIN_SVG_MARKUP;
        new maplibregl.Marker({ element: el }).setLngLat([returnPoint.lng, returnPoint.lat]).addTo(map);
        bounds.extend([returnPoint.lng, returnPoint.lat]);
      }
```

Update the import line from `import { CHECK_SVG_MARKUP } from "./icons";` to:

```ts
import { CHECK_SVG_MARKUP, PIN_SVG_MARKUP } from "./icons";
```

- [ ] **Step 2: Pass `returnPoint` from `RouteDetailModal` and show it in the detail grid**

In `src/components/RouteDetailModal.tsx`, add a new entry to the `<dl className="history-detail__grid">`, right after the "Paradas" `<div>` block:

```tsx
            <div>
              <dt>Punto de retorno</dt>
              <dd>{record.returnPoint?.label ?? "—"}</dd>
            </div>
```

Update the `<RouteDetailMap>` call to pass the new prop:

```tsx
                <RouteDetailMap
                  stops={stops}
                  geometry={record.geometry}
                  origin={record.origin}
                  returnPoint={record.returnPoint}
                />
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/RouteDetailModal.tsx src/components/RouteDetailMap.tsx
git commit -m "Muestra el punto de retorno usado en el detalle de una ruta guardada"
```

---

### Task 12: Verificación end-to-end en el navegador

**Files:** ninguno (solo verificación manual/scripted, sin cambios de código).

**Interfaces:** ninguna nueva — este task ejercita todo lo construido en los Tasks 1–11.

- [ ] **Step 1: Run the full automated test suite and typecheck one more time**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 2: Start the dev server**

Run: `cd d:/Datos/Documentos/Proyectos/Daniel/rutafacil && npm run dev`
Expected: prints a local URL (e.g. `http://localhost:5173`, or the next free port if that one's taken — check the actual printed port before continuing).

- [ ] **Step 3: Exercise the full flow manually in a browser**

1. Open the printed URL. Paste two coordinate pairs into the "Pega enlaces de Maps o coordenadas" box, one per line (e.g. `4.65, -74.05` and `4.62, -74.03`), click "Agregar" — confirm 2 stops appear.
2. Click the new "Punto de retorno" button next to the paste box. Confirm the sheet opens and, since no points are saved yet, it goes straight to the creation form.
3. Type a name (e.g. "Bodega"), paste a third coordinate pair (e.g. `4.7, -74.1`) into the location box, click "Usar enlace pegado" — confirm the coordinates appear under "Ubicación".
4. Click "Guardar" — confirm the sheet closes and the trigger button now reads "Bodega".
5. Click "Armar ruta". Confirm the bottom toast reports a distance, and switch to the list view: confirm a new row "Punto de retorno · Bodega · +X.X km" appears **after** both stops, at the very end of the list.
6. Toggle to "Mapa" view: confirm a third marker (distinct color, pin icon) appears at the return point's coordinates, and it's included in the map's zoom-to-fit.
7. Open the "Punto de retorno" sheet again: confirm "Bodega" appears in the saved list, and click "Quitar de esta ruta" — confirm the return-point row disappears from the list view and the trigger button reverts to "Punto de retorno".
8. Open the history panel (clock icon, top right), open the detail view for the current route: confirm a "Punto de retorno" field appears in the detail grid (showing "—" since it was removed in step 7, or "Bodega" if you skip step 7 before checking history).
9. Stop the dev server (Ctrl+C).

- [ ] **Step 4: Confirm no console errors occurred**

While performing Step 3, keep the browser DevTools console open; confirm no red errors appear (warnings from MapLibre/react-hot-toast are expected and fine).

- [ ] **Step 5: Final commit (if Step 3 uncovered fixes)**

If any bug was found and fixed during manual verification, commit it separately with a message describing what was wrong (e.g. `git commit -m "Corrige <lo que falló> encontrado en verificación manual"`). If nothing needed fixing, no commit is needed for this task.

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-07-13-punto-de-retorno-design.md` maps to a task — data model (Tasks 3–4), UI flow (Tasks 6–10), routing engine (Tasks 1–2, 5), historial (Task 11), casos borde (delete-doesn't-affect-active-route is Task 9's `handleDelete`, which only calls `setReturnPoint(null)` when the deleted point *is* the active one — otherwise the active route's snapshot is untouched).
- **Type consistency check:** `SavedReturnPoint` (Task 3) → consumed as-is by `returnPointsStore.ts` (Task 3) and `ReturnPointSheet.tsx` (Task 9). `RouteState.returnPoint` shape `{ id, label, lat, lng }` (Task 4) is what `ReturnPointSheet.handleUse`/`handleSave` construct (Task 9) and what `RoadList`/`MapView` read (Task 10) and what `syncHistory` copies into `RouteHistoryRecord.returnPoint` — but note `RouteHistoryRecord.returnPoint` (Task 3) is typed `{ lat, lng, label } | null` (no `id`) while `RouteState.returnPoint` has an extra `id` field; since `syncHistory` does `returnPoint: s.returnPoint` (structural assignment, TS allows the wider object where the narrower shape is expected as long as it's not an exact-object-literal check), this compiles fine — the `id` is simply carried along harmlessly in the stored JSON. No action needed.
- **`TripResult.returnLegKm` naming**: consistent across `routing.ts` (Task 2), `routeStore.ts`'s `OptimizationResult.returnLegKm` (Task 4), `OptimizeBar`/`LiveTracker` (Task 5) — same name throughout, verified.
