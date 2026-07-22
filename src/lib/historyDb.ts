import type { TransportMode } from "./routing";

const DB_NAME = "rutafacil-history";
const DB_VERSION = 3;
const STORE = "routes";
const RETURN_POINTS_STORE = "returnPoints";

/** Copia liviana de una parada, tal como estaba al guardar el registro. No
 * reutiliza el tipo `Stop` de routeStore.ts para evitar un ciclo de
 * importación (routeStore ya importa de este archivo). */
export interface HistoryStop {
  id: string;
  lat: number;
  lng: number;
  label: string;
  delivered: boolean;
  legKm?: number;
  collectAmount?: number;
  travelAllowance?: number;
  notes?: string;
  assignee?: string;
  deliveredAt?: number;
}

export interface RouteHistoryRecord {
  id: string;
  label: string;
  /** Cuándo se creó el registro (primera parada de esta ruta). */
  createdAt: number;
  /** Última vez que algo de esta ruta cambió. */
  updatedAt: number;
  /** Cuándo se activó "Seguir" por primera vez para esta ruta (null si nunca). */
  trackingStartedAt: number | null;
  /** Cuándo se marcó la última entrega pendiente como completada (null si no terminó). */
  completedAt: number | null;
  /** completedAt - trackingStartedAt; null si falta alguno de los dos. */
  elapsedMs: number | null;
  mode: TransportMode;
  stopsTotal: number;
  stopsDelivered: number;
  distanceKm: number | null;
  status: "active" | "completed";
  /** Paradas al momento del último guardado, para la vista de detalle.
   * Ausente en registros guardados antes de esta función. */
  stops?: HistoryStop[];
  /** Geometría de la ruta por calles [lng, lat]; null si fue línea recta. */
  geometry?: [number, number][] | null;
  origin?: { lat: number; lng: number } | null;
  /** Punto de retorno usado al momento de guardar este registro, si tenía uno. */
  returnPoint?: { lat: number; lng: number; label: string } | null;
}

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

/** Crea o reemplaza un registro de ruta en el historial. */
export async function putRoute(record: RouteHistoryRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Borra varios registros en una sola transacción (eliminar por lotes). */
export async function deleteRoutes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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

/** Todas las rutas guardadas, de la más reciente a la más antigua. */
export async function listRoutes(): Promise<RouteHistoryRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("updatedAt");
    const results: RouteHistoryRecord[] = [];
    const req = index.openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as RouteHistoryRecord);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export function defaultRouteLabel(createdAt: number): string {
  const d = new Date(createdAt);
  const date = d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return `Ruta ${date} · ${time}`;
}

export function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m} min` : `${h}h ${m}min`;
}

/**
 * Pide al navegador que el origen use almacenamiento "persistente": el
 * sistema no debería poder borrarlo solo por falta de espacio (a diferencia
 * del modo "best-effort" por defecto, que sí puede vaciarse sin avisar).
 * Es una PETICIÓN, no una garantía — algunos navegadores la conceden sola
 * si la PWA está instalada o el sitio tiene buen uso; otros piden permiso.
 * Devuelve el estado final (concedido o no).
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    const already = (await navigator.storage.persisted?.()) ?? false;
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
