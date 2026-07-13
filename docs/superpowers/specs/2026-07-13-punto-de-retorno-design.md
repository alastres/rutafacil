# Punto de retorno — diseño

**Fecha:** 2026-07-13
**Estado:** Aprobado, pendiente de plan de implementación

## Resumen

Hoy RutaFácil solo conoce un "punto" especial: `origin`, el punto de partida
resuelto por GPS (o la primera parada) al momento de optimizar. No existe
ningún concepto de punto reutilizable ni una forma de fijarlo manualmente —
todo se define pegando enlaces de Maps/WhatsApp o coordenadas.

Esta feature añade **puntos de retorno**: ubicaciones guardadas y reutilizables
(ej. "Bodega", "Casa") que el usuario puede asignar a cualquier ruta. Cuando
una ruta tiene un punto de retorno asignado, el motor de optimización lo
coloca siempre como el **último** punto del recorrido, sin importar el orden
en que se resuelvan las demás paradas.

## Alcance

- Varios puntos de retorno guardados, con nombre, reutilizables entre rutas.
- El usuario puede definirlos pegando un enlace/coordenadas **o** tocando el
  mapa.
- Un botón junto a `AddStop`, siempre visible, para asignar/gestionar el punto
  de retorno de la ruta activa.
- El punto de retorno siempre es el último nodo del recorrido optimizado
  (OSRM, Mapbox y el fallback haversine deben respetarlo).
- No cuenta como parada entregable: no participa en `stopsTotal`/
  `stopsDelivered`, no se puede marcar "entregado".
- Se persiste en IndexedDB (no localStorage), consistente con el pedido de
  "que se guarde en la base de datos" y con `ensurePersistentStorage()`.

Fuera de alcance (no se construye en esta iteración):
- Compartir puntos de retorno entre dispositivos/usuarios (sync remoto).
- Reordenar manualmente el punto de retorno dentro de la lista de paradas.
- Marcar el punto de retorno como "entregado" o darle su propia foto/nota.

## Modelo de datos

### Nuevo store IndexedDB: `returnPoints`

En `src/lib/historyDb.ts`, se sube `DB_VERSION` de `1` a `2` y se añade el
nuevo object store en `onupgradeneeded`:

```ts
export interface SavedReturnPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  createdAt: number;
  updatedAt: number;
}
```

Nuevas funciones (mismo patrón que `putRoute`/`deleteRoute`/`listRoutes`):
- `putReturnPoint(point: SavedReturnPoint): Promise<void>`
- `deleteReturnPoint(id: string): Promise<void>`
- `listReturnPoints(): Promise<SavedReturnPoint[]>` — ordenados por `label`
  (a diferencia de `listRoutes`, que ordena por `updatedAt`; aquí importa más
  encontrar el punto por nombre que por recencia).

Nota de implementación: puede vivir en `historyDb.ts` directamente (mismo
archivo, misma DB) o extraerse a `src/lib/returnPointsDb.ts` que abre la
misma DB (`rutafacil-history`) — se decide en el plan de implementación según
qué tan grande quede `historyDb.ts`.

### Nuevo store de Zustand: `src/state/returnPointsStore.ts`

Mismo patrón que `historyStore.ts`:

```ts
interface ReturnPointsState {
  points: SavedReturnPoint[];
  refresh: () => Promise<void>;
  save: (point: SavedReturnPoint) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```

### `routeStore.ts` — ruta activa

Nuevo campo en `RouteState`:

```ts
returnPoint: { id: string; label: string; lat: number; lng: number } | null;
```

Es una **copia** del `SavedReturnPoint` elegido (no una referencia por id) —
así, si el usuario borra o renombra el punto guardado después, la ruta activa
y el historial ya escrito siguen mostrando el nombre/ubicación que tenían al
momento de asignarlo.

Nueva acción:

```ts
setReturnPoint(point: { id: string; label: string; lat: number; lng: number } | null): void
```

Comportamiento, igual que `addStop`/`removeStop`:
- Guarda el valor en el estado.
- Invalida el cálculo previo (`optimizedKm: null`, `durationMin: null`,
  `geometry: null`, `byStreets: false`) para forzar un recálculo en el
  próximo "Armar ruta".
- Dispara `syncHistory` si `historyId` ya existe.

`clearRoute()` también resetea `returnPoint: null`.

`syncHistory(s)` incluye `returnPoint: s.returnPoint` al construir el
`RouteHistoryRecord`.

### `historyDb.ts` — `RouteHistoryRecord`

Nuevo campo opcional, mismo patrón que `origin?`:

```ts
returnPoint?: { lat: number; lng: number; label: string } | null;
```

## Flujo de UI

### Botón "Punto de retorno" junto a `AddStop`

- Vive en el mismo bloque que `AddStop` en `App.tsx`, siempre visible
  (no depende de que la ruta tenga paradas).
- Estado sin asignar: chip/botón "+ Punto de retorno".
- Estado asignado: chip/botón "↩ {label}" (ej. "↩ Bodega"), tocable para
  cambiar o quitar.

### Hoja de selección (nuevo componente `ReturnPointSheet.tsx`)

Reutiliza el lenguaje visual de `HistoryPanel` (`.history-overlay`/
`.history-panel`, overlay + panel deslizante desde abajo):

- Si hay puntos guardados: lista con nombre + botón "Usar" (llama
  `routeStore.setReturnPoint`) y un ícono de borrar por ítem (llama
  `returnPointsStore.remove`, con confirmación tipo `confirm-modal` como ya
  existe para borrar rutas del historial).
- Botón "+ Nuevo punto" (arriba de la lista, o directo si la lista está
  vacía).
- Si la ruta activa ya tiene un punto asignado: opción "Quitar de esta ruta"
  (llama `setReturnPoint(null)`, **no** borra el punto guardado).

### Crear/editar un punto (nuevo componente `ReturnPointForm.tsx`)

Formulario simple:
- Campo de texto para el nombre (ej. "Bodega").
- Dos formas de fijar la ubicación:
  1. **Pegar enlace/coordenadas** — reutiliza `parseAllLocations` (o una
     variante de una sola ubicación) de `src/lib/parse.ts`, mismo textarea +
     botón "Pegar" que ya usa `AddStop.tsx`.
  2. **Tocar el mapa** — nuevo componente `MapPointPicker.tsx`: un mapa
     MapLibre con un pin fijo en el centro de la pantalla; el usuario mueve
     el mapa (arrastra/hace zoom) y al confirmar se lee `map.getCenter()`.
     Este patrón evita tener que implementar detección de clics/hit-testing
     sobre el mapa.
- Al guardar: `putReturnPoint` + `returnPointsStore.refresh()` +
  `routeStore.setReturnPoint(...)` (se asigna automáticamente a la ruta
  activa recién creado).

### `RoadList.tsx`

Nueva fila especial al final de la lista de paradas (después del
`stops.map`), visible en cuanto `routeStore.returnPoint` no es `null` — a
diferencia de la fila de origen (`optimized && origin`), esta **no** depende
de que la ruta ya esté optimizada, porque el punto ya se conoce de antemano.

Mismo lenguaje visual que la fila de origen:
- Nuevas clases CSS `.road-return`, `.marker-return` (análogas a
  `.road-origin`/`.marker-origin`), reutilizando `.origin-chip` para el
  texto.
- Muestra el nombre del punto y, si ya hay ruta optimizada, la distancia del
  tramo final (`returnLegKm`, ver más abajo).

### `MapView.tsx`

- Nuevo marcador para `returnPoint` (clase `.map-marker.is-return`, ícono
  distinto al de origen — ej. bandera).
- Se incluye en el cálculo de `bounds.extend` junto a `stops` y `origin`.

### `RouteDetailModal.tsx` / `RouteDetailMap.tsx`

Mismo patrón que ya existe para `record.origin`:
- Nueva fila en el `<dl>` de detalle: "Punto de retorno" → nombre (o "—" si
  no se usó).
- Se pasa a `RouteDetailMap` para dibujarlo en el mini-mapa histórico.

## Motor de ruteo

### `src/lib/tsp.ts` — fallback sin internet

`optimizeOrder` gana un parámetro opcional:

```ts
export function optimizeOrder(
  origin: LatLng,
  stops: LatLng[],
  fixedEnd?: LatLng,
): number[]
```

Cuando `fixedEnd` está presente, se agrega como nodo adicional a la matriz de
distancias, pero:
- El vecino-más-cercano nunca lo visita hasta el final (se fuerza como
  último paso).
- El 2-opt solo reordena el rango `[1, n-1]` (las paradas intermedias),
  dejando fijos tanto el origen (posición 0) como el punto de retorno
  (última posición).

`pathLengthKm` gana el mismo parámetro opcional para incluir el tramo final
en la distancia total.

### `src/lib/routing.ts`

`tripThroughStreets` gana un parámetro opcional:

```ts
export async function tripThroughStreets(
  origin: LatLng,
  stops: LatLng[],
  opts: { timeoutMs?: number; mode?: TransportMode; returnPoint?: LatLng } = {},
): Promise<TripResult | null>
```

- **OSRM (`tryBase`)**: si `returnPoint` está presente, se agrega como
  última coordenada en `coords` y se cambia `&destination=last` (hoy la URL
  no pasa `destination`, por lo que OSRM asume `any`). El cálculo de
  `order`/`legsKm` sigue igual (solo mira `positions[1..stops.length]`, sin
  tocar la posición del punto de retorno). Con `destination=last` OSRM
  garantiza que el punto de retorno es el último waypoint del viaje, así que
  su tramo de llegada es siempre `trip.legs[trip.legs.length - 1]` — de ahí
  sale `returnLegKm`.
- **Mapbox (`tripMapbox`)**: se agrega `returnPoint` como último elemento de
  `sequence`, después de aplicar `optimizeOrder` a las paradas intermedias.
- `TripResult` gana un campo opcional `returnLegKm?: number` — la distancia
  del último tramo (hasta el punto de retorno), separado de `legsKm` para no
  romper el mapeo `legsKm[i] ↔ stops[order[i]]` que ya usa `RoadList`.

### Puntos de integración

- `OptimizeBar.handleOptimize`: pasa `routeStore.returnPoint` (convertido a
  `LatLng`) a `tripThroughStreets` y al fallback `optimizeOrder`.
- `routeStore.setMode` (re-optimiza al cambiar de vehículo): también pasa el
  `returnPoint` actual.
- `LiveTracker.reroute`: pasa `returnPoint` al recalcular tras una
  desviación, para que el recorrido restante siga terminando en el punto de
  retorno.

## Casos borde

- **Borrar un punto guardado** de la biblioteca no afecta rutas activas o
  históricas que ya lo usaban — usan su copia (`routeStore.returnPoint` /
  `record.returnPoint`), no una referencia.
- **Sin puntos guardados aún**: el botón "+ Punto de retorno" lleva directo
  al formulario de creación en vez de mostrar una lista vacía.
- **Fallos de red** al pegar enlace o al optimizar con punto de retorno:
  mismos toasts de error que ya existen hoy (`ingest`, `tripThroughStreets`
  → fallback silencioso a `optimizeOrder`).
- **Cambiar/quitar el punto de retorno de una ruta ya optimizada**: se trata
  igual que agregar/quitar una parada — invalida el cálculo y exige volver a
  tocar "Armar ruta".

## Testing

- `src/lib/tsp.test.ts`: casos nuevos para `optimizeOrder(origin, stops,
  fixedEnd)` — verificar que el punto fijo final nunca se mueve y que el
  2-opt sigue optimizando el resto.
- `src/lib/parse.test.ts`: sin cambios necesarios; se reutiliza tal cual
  para el flujo de pegar en `ReturnPointForm`.
- IndexedDB (`returnPoints`): sin test automatizado (igual que
  `historyDb.ts` hoy, que tampoco tiene tests — no hay wrapper `idb`/
  `fake-indexeddb` en el proyecto). Se valida manualmente vía `/run`.

## Archivos afectados (resumen para el plan de implementación)

- `src/lib/historyDb.ts` — bump `DB_VERSION`, nuevo store, nuevas funciones,
  campo `returnPoint?` en `RouteHistoryRecord`.
- `src/state/returnPointsStore.ts` — **nuevo**.
- `src/state/routeStore.ts` — campo + acción `setReturnPoint`, invalidación,
  `syncHistory`, `clearRoute`.
- `src/lib/tsp.ts` — `fixedEnd` en `optimizeOrder`/`pathLengthKm`.
- `src/lib/routing.ts` — `returnPoint` en `tripThroughStreets`, `tryBase`,
  `tripMapbox`, `TripResult.returnLegKm`.
- `src/components/ReturnPointSheet.tsx` — **nuevo**.
- `src/components/ReturnPointForm.tsx` — **nuevo**.
- `src/components/MapPointPicker.tsx` — **nuevo**.
- `src/components/RoadList.tsx` — fila de punto de retorno.
- `src/components/MapView.tsx` — marcador de punto de retorno.
- `src/components/OptimizeBar.tsx` — pasar `returnPoint` a la optimización.
- `src/components/LiveTracker.tsx` — pasar `returnPoint` al recalcular.
- `src/components/RouteDetailModal.tsx` / `RouteDetailMap.tsx` — mostrar
  `record.returnPoint`.
- `src/App.tsx` — montar el botón/trigger junto a `AddStop`.
- `src/styles/global.css` — `.road-return`, `.marker-return`,
  `.map-marker.is-return`, estilos de `ReturnPointSheet`/`ReturnPointForm`/
  `MapPointPicker`.
