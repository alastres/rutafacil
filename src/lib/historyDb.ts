import type { TransportMode } from "./routing";

const DB_NAME = "rutafacil-history";
const DB_VERSION = 1;
const STORE = "routes";

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
