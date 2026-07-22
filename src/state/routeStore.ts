import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createElement } from "react";
import { haversineKm, type LatLng } from "../lib/geo";
import { optimizeOrder } from "../lib/tsp";
import { tripThroughStreets } from "../lib/routing";
import type { TransportMode } from "../lib/routing";
import { withLoader } from "./loadingStore";
import { showToast } from "../lib/toast";
import { AlertIcon } from "../components/icons";
import { putRoute, defaultRouteLabel, type RouteHistoryRecord } from "../lib/historyDb";
import { clearNotifiedStops } from "../lib/notification";

export interface Stop {
  id: string;
  lat: number;
  lng: number;
  label: string;
  delivered: boolean;
  createdAt: number;
  /** Km del tramo que llega a esta parada (por calles si byStreets) */
  legKm?: number;
  collectAmount?: number;
  travelAllowance?: number;
  notes?: string;
  assignee?: string;
  deliveredAt?: number;
}

export interface OptimizationResult {
  /** Paradas pendientes en el orden de visita, con legKm calculado */
  ordered: Stop[];
  origin: LatLng;
  km: number;
  durationMin: number | null;
  /** Geometría de la ruta por calles [lng, lat], o null si es línea recta */
  geometry: [number, number][] | null;
  byStreets: boolean;
  returnLegKm?: number | null;
}

interface RouteState {
  stops: Stop[];
  /** null = la ruta aún no se ha optimizado desde la última modificación */
  optimizedKm: number | null;
  durationMin: number | null;
  byStreets: boolean;
  origin: LatLng | null;
  /** Punto de retorno asignado a la ruta activa (copia, no una referencia:
   * si el punto guardado se borra o renombra después, la ruta activa y el
   * historial ya escrito conservan el nombre/ubicación que tenían). */
  returnPoint: { id: string; label: string; lat: number; lng: number } | null;
  /** Km del tramo final hasta el punto de retorno, una vez optimizada la
   * ruta; null si no hay punto de retorno o aún no se ha optimizado. */
  returnLegKm: number | null;
  /** Geometría de la ruta optimizada vigente; null si fue línea recta */
  geometry: [number, number][] | null;
  mode: TransportMode;
  /** null si no hay GPS o seguimiento desactivado */
  live: LatLng | null;
  tracking: boolean;
  routeVersion: number;
  /**
   * Identidad de la ruta activa en el historial (IndexedDB). Se crea sola
   * con la primera parada y se suelta al vaciar la ruta o tocar "Nueva" —
   * así cada tanda de entregas queda como un registro propio.
   */
  historyId: string | null;
  historyLabel: string | null;
  historyCreatedAt: number | null;
  /** Cuándo se activó "Seguir" por primera vez para la ruta activa. */
  trackingStartedAt: number | null;
  /** Cuándo se marcó la última entrega pendiente como completada. */
  completedAt: number | null;
  addStop: (lat: number, lng: number, label?: string) => void;
  addEnrichedStop: (data: {
    lat: number;
    lng: number;
    label: string;
    collectAmount?: number;
    travelAllowance?: number;
    notes?: string;
    assignee?: string;
  }) => void;
  removeStop: (id: string) => void;
  renameStop: (id: string, label: string) => void;
  reorderStops: (newPendingStops: Stop[]) => void;
  toggleDelivered: (id: string) => void;
  markStopDelivered: (id: string) => void;
  clearRoute: () => void;
  setReturnPoint: (
    point: { id: string; label: string; lat: number; lng: number } | null,
  ) => void;
  /** Renombra la ruta activa (usado por el panel de historial). */
  setHistoryLabel: (label: string) => Promise<void>;
  /**
   * Desvincula la ruta en pantalla de su registro de historial, sin tocar
   * las paradas visibles. Se usa cuando ese registro se borra desde el
   * panel mientras la ruta sigue activa: si no se hiciera, el siguiente
   * cambio (una entrega marcada, etc.) volvería a escribirlo en
   * IndexedDB con los datos vigentes, "resucitando" lo que se acababa de
   * borrar.
   */
  detachHistory: (id: string) => void;
  /** Reserva la siguiente versión antes de iniciar un cálculo de ruta. */
  beginRouteRequest: () => number;
  /**
   * Aplica un resultado de optimización. Si se pasa `version` y ya no
   * coincide con la más reciente (`routeVersion`), el resultado se descarta
   * en silencio: llegó tarde y una solicitud posterior ya ganó.
   */
  applyOptimization: (result: OptimizationResult, version?: number) => void;
  setLive: (pos: LatLng | null) => void;
  startTracking: () => void;
  stopTracking: () => void;
  setMode: (mode: TransportMode) => Promise<void>;
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
const newHistoryId = () =>
  `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Una modificación de paradas invalida la optimización vigente */
const invalidated = {
  optimizedKm: null,
  durationMin: null,
  geometry: null,
  returnLegKm: null,
} as const;

/**
 * Recalcula el registro de historial a partir del estado actual y lo guarda
 * en IndexedDB (best-effort: si falla — p. ej. modo privado restringido —
 * no debe romper la app, solo se pierde ese registro puntual).
 */
function syncHistory(s: RouteState): Promise<void> {
  if (!s.historyId || s.stops.length === 0) return Promise.resolve();
  const delivered = s.stops.filter((st) => st.delivered).length;
  const record: RouteHistoryRecord = {
    id: s.historyId,
    label: s.historyLabel ?? defaultRouteLabel(s.historyCreatedAt ?? Date.now()),
    createdAt: s.historyCreatedAt ?? Date.now(),
    updatedAt: Date.now(),
    trackingStartedAt: s.trackingStartedAt,
    completedAt: s.completedAt,
    elapsedMs:
      s.completedAt !== null && s.trackingStartedAt !== null
        ? s.completedAt - s.trackingStartedAt
        : null,
    mode: s.mode,
    stopsTotal: s.stops.length,
    stopsDelivered: delivered,
    distanceKm: s.optimizedKm,
    status: s.completedAt !== null ? "completed" : "active",
    stops: s.stops.map((st) => ({
      id: st.id,
      lat: st.lat,
      lng: st.lng,
      label: st.label,
      delivered: st.delivered,
      legKm: st.legKm,
      collectAmount: st.collectAmount,
      travelAllowance: st.travelAllowance,
      notes: st.notes,
      assignee: st.assignee,
      deliveredAt: st.deliveredAt,
    })),
    geometry: s.geometry,
    origin: s.origin,
    returnPoint: s.returnPoint,
  };
  // best-effort: si falla (p. ej. modo privado restringido) no debe romper
  // la app, solo se pierde ese guardado puntual.
  return putRoute(record).catch(() => {});
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      stops: [],
      optimizedKm: null,
      durationMin: null,
      byStreets: false,
      origin: null,
      returnPoint: null,
      returnLegKm: null,
      geometry: null,
      mode: "car",
      live: null,
      tracking: false,
      routeVersion: 0,
      historyId: null,
      historyLabel: null,
      historyCreatedAt: null,
      trackingStartedAt: null,
      completedAt: null,

      addStop: (lat, lng, label) => {
        const now = Date.now();
        const isFresh = get().historyId === null;
        set((s) => ({
          stops: [
            ...s.stops,
            {
              id: newId(),
              lat,
              lng,
              label: label ?? `Parada ${s.stops.length + 1}`,
              delivered: false,
              createdAt: now,
            },
          ],
          ...invalidated,
          ...(isFresh
            ? {
                historyId: newHistoryId(),
                historyLabel: null,
                historyCreatedAt: now,
                trackingStartedAt: null,
                completedAt: null,
              }
            : {}),
        }));
        syncHistory(get());
      },

      addEnrichedStop: (data) => {
        const now = Date.now();
        const isFresh = get().historyId === null;
        set((s) => ({
          stops: [
            ...s.stops,
            {
              id: newId(),
              lat: data.lat,
              lng: data.lng,
              label: data.label ?? `Parada ${s.stops.length + 1}`,
              delivered: false,
              createdAt: now,
              collectAmount: data.collectAmount,
              travelAllowance: data.travelAllowance,
              notes: data.notes,
              assignee: data.assignee,
            },
          ],
          ...invalidated,
          ...(isFresh
            ? {
                historyId: newHistoryId(),
                historyLabel: null,
                historyCreatedAt: now,
                trackingStartedAt: null,
                completedAt: null,
              }
            : {}),
        }));
        syncHistory(get());
      },

      markStopDelivered: (id) => {
        set((s) => {
          const stops = s.stops.map((st) =>
            st.id === id ? { ...st, delivered: true, deliveredAt: st.deliveredAt ?? Date.now() } : st,
          );
          const allDelivered = stops.length > 0 && stops.every((st) => st.delivered);
          return {
            stops,
            completedAt: allDelivered ? (s.completedAt ?? Date.now()) : null,
          };
        });
        syncHistory(get());
      },

      removeStop: (id) => {
        set((s) => ({
          stops: s.stops.filter((st) => st.id !== id),
          ...invalidated,
        }));
        const s = get();
        if (s.stops.length === 0) {
          // Ruta vaciada: no queda nada útil que conservar como registro
          set({
            historyId: null,
            historyLabel: null,
            historyCreatedAt: null,
            trackingStartedAt: null,
            completedAt: null,
          });
        } else {
          syncHistory(s);
        }
      },

      renameStop: (id, label) => {
        set((s) => ({
          stops: s.stops.map((st) => (st.id === id ? { ...st, label } : st)),
        }));
        syncHistory(get());
      },

      reorderStops: async (newPendingStops) => {
        const done = get().stops.filter((s) => s.delivered);
        const updatedStops = [...done, ...newPendingStops];

        // Si la ruta aún no ha sido optimizada, no hay kilómetros ni trazo en mapa.
        // Solo guardamos el nuevo orden de paradas y sincronizamos el historial.
        if (get().optimizedKm === null) {
          set({ stops: updatedStops });
          syncHistory(get());
          return;
        }

        // Si la ruta ya estaba optimizada, recalculamos estadísticas y geometría
        const origin = get().origin ?? updatedStops[0];
        const returnPoint = get().returnPoint ?? undefined;
        const mode = get().mode;

        if (get().byStreets) {
          const version = get().beginRouteRequest();
          const trip = await tripThroughStreets(origin, newPendingStops, {
            mode,
            returnPoint,
            optimize: false,
          });

          if (trip) {
            const ordered = trip.order.map((i, idx) => ({
              ...newPendingStops[i],
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
        }

        // Respaldo en línea recta si no era por calles o si el OSRM falló
        let prev: LatLng = origin;
        const ordered = newPendingStops.map((stop) => {
          const newStop = { ...stop, legKm: haversineKm(prev, stop) };
          prev = stop;
          return newStop;
        });
        let km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
        let returnLegKm: number | null = null;
        if (returnPoint) {
          returnLegKm = haversineKm(prev, returnPoint);
          km += returnLegKm;
        }

        set({
          stops: [...done, ...ordered],
          optimizedKm: km,
          durationMin: null,
          geometry: null,
          byStreets: false,
          returnLegKm,
        });
        syncHistory(get());
      },

      toggleDelivered: (id) => {
        set((s) => {
          const stops = s.stops.map((st) => {
            if (st.id === id) {
              const nextDelivered = !st.delivered;
              return {
                ...st,
                delivered: nextDelivered,
                deliveredAt: nextDelivered ? (st.deliveredAt ?? Date.now()) : undefined,
              };
            }
            return st;
          });
          const allDelivered = stops.length > 0 && stops.every((st) => st.delivered);
          return {
            stops,
            // Se completa la primera vez que todas quedan entregadas; si se
            // deshace una entrega, la ruta vuelve a quedar "en curso".
            completedAt: allDelivered ? (s.completedAt ?? Date.now()) : null,
          };
        });
        syncHistory(get());
      },

      clearRoute: () => {
        // Último guardado del registro saliente antes de soltarlo — "Nueva"
        // no borra el historial, solo empieza una tanda de entregas distinta.
        syncHistory(get());
        clearNotifiedStops();
        set({
          stops: [],
          origin: null,
          returnPoint: null,
          byStreets: false,
          live: null,
          tracking: false,
          historyId: null,
          historyLabel: null,
          historyCreatedAt: null,
          trackingStartedAt: null,
          completedAt: null,
          ...invalidated,
        });
      },

      setReturnPoint: (point) => {
        set({ returnPoint: point, ...invalidated });
        syncHistory(get());

        const { origin, stops, mode } = get();
        const pending = stops.filter((s) => !s.delivered);
        // Solo recalculamos si ya se había armado la ruta previamente (hay origen y paradas)
        if (!origin || pending.length < 1) return;

        void (async () => {
          const version = get().beginRouteRequest();
          const trip = await withLoader(() =>
            tripThroughStreets(origin, pending, {
              mode,
              returnPoint: point ?? undefined,
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

          // Respaldo en línea recta si falla
          if (version !== get().routeVersion) return;
          const order = optimizeOrder(origin, pending, point ?? undefined);
          let prev: LatLng = origin;
          const ordered = order.map((i) => {
            const stop = { ...pending[i], legKm: haversineKm(prev, pending[i]) };
            prev = stop;
            return stop;
          });
          let km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
          let returnLegKm: number | null = null;
          if (point) {
            returnLegKm = haversineKm(prev, point);
            km += returnLegKm;
          }
          get().applyOptimization(
            { ordered, origin, km, durationMin: null, geometry: null, byStreets: false, returnLegKm },
            version,
          );
        })();
      },

      setHistoryLabel: async (label) => {
        set({ historyLabel: label });
        await syncHistory(get());
      },

      detachHistory: (id) => {
        if (get().historyId !== id) return;
        set({
          historyId: null,
          historyLabel: null,
          historyCreatedAt: null,
          trackingStartedAt: null,
          completedAt: null,
        });
      },

      setLive: (pos) => set({ live: pos }),

      startTracking: () => {
        set((s) => ({
          tracking: true,
          live: null,
          // Solo se marca la primera vez: si el usuario para y vuelve a
          // seguir la MISMA ruta, la duración sigue contando desde el inicio.
          trackingStartedAt: s.trackingStartedAt ?? Date.now(),
        }));
        syncHistory(get());
      },

      stopTracking: () => set({ tracking: false, live: null }),

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
        showToast(
          "Sin conexión al servicio de rutas para este vehículo: orden calculado en línea recta.",
          {
            icon: createElement(AlertIcon, { width: 18, height: 18 }),
            className: "rht rht--error",
          },
        );
      },

      beginRouteRequest: () => {
        const version = get().routeVersion + 1;
        set({ routeVersion: version });
        return version;
      },

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
    }),
    { name: "rutafacil-route" },
  ),
);
