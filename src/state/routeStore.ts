import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "react-hot-toast";
import { haversineKm, type LatLng } from "../lib/geo";
import { optimizeOrder } from "../lib/tsp";
import { tripThroughStreets } from "../lib/routing";
import type { TransportMode } from "../lib/routing";

export interface Stop {
  id: string;
  lat: number;
  lng: number;
  label: string;
  delivered: boolean;
  createdAt: number;
  /** Km del tramo que llega a esta parada (por calles si byStreets) */
  legKm?: number;
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
}

interface RouteState {
  stops: Stop[];
  /** null = la ruta aún no se ha optimizado desde la última modificación */
  optimizedKm: number | null;
  durationMin: number | null;
  byStreets: boolean;
  origin: LatLng | null;
  geometry: [number, number][] | null;
  /** Modo de transporte usado para calcular la ruta */
  mode: TransportMode;
  /** Posición GPS en vivo del usuario mientras se sigue la ruta */
  live: LatLng | null;
  /** true = geolocalización observando en vivo */
  tracking: boolean;
  /**
   * Contador de la última solicitud de cálculo de ruta iniciada (Armar ruta,
   * cambio de vehículo, recálculo automático en vivo). Sirve para descartar
   * respuestas obsoletas cuando dos cálculos se solapan: la petición A puede
   * resolver DESPUÉS que la B aunque A se haya iniciado antes, y sin esta
   * guarda su resultado atrasado pisaba el de B (p. ej. cambiar de "auto" a
   * "bici" rápido podía dejar en pantalla la ruta de "auto").
   */
  routeVersion: number;
  addStop: (lat: number, lng: number, label?: string) => void;
  removeStop: (id: string) => void;
  renameStop: (id: string, label: string) => void;
  toggleDelivered: (id: string) => void;
  clearRoute: () => void;
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

/** Una modificación de paradas invalida la optimización vigente */
const invalidated = {
  optimizedKm: null,
  durationMin: null,
  geometry: null,
} as const;

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      stops: [],
      optimizedKm: null,
      durationMin: null,
      byStreets: false,
      origin: null,
      geometry: null,
      mode: "car",
      live: null,
      tracking: false,
      routeVersion: 0,

      addStop: (lat, lng, label) =>
        set((s) => ({
          stops: [
            ...s.stops,
            {
              id: newId(),
              lat,
              lng,
              label: label ?? `Parada ${s.stops.length + 1}`,
              delivered: false,
              createdAt: Date.now(),
            },
          ],
          ...invalidated,
        })),

      removeStop: (id) =>
        set((s) => ({
          stops: s.stops.filter((st) => st.id !== id),
          ...invalidated,
        })),

      renameStop: (id, label) =>
        set((s) => ({
          stops: s.stops.map((st) => (st.id === id ? { ...st, label } : st)),
        })),

      toggleDelivered: (id) =>
        set((s) => ({
          stops: s.stops.map((st) =>
            st.id === id ? { ...st, delivered: !st.delivered } : st,
          ),
        })),

      clearRoute: () =>
        set({
          stops: [],
          origin: null,
          byStreets: false,
          live: null,
          tracking: false,
          ...invalidated,
        }),

      setLive: (pos) => set({ live: pos }),

      startTracking: () => set({ tracking: true, live: null }),

      stopTracking: () => set({ tracking: false, live: null }),

      setMode: async (mode) => {
        const { origin, stops } = get();
        const pending = stops.filter((s) => !s.delivered);
        const version = get().beginRouteRequest();
        set({ mode, ...invalidated });
        // Si ya había ruta optimizada, la recalcula para el nuevo vehículo
        if (!origin || pending.length < 1) return;

        const trip = await tripThroughStreets(origin, pending, { mode });
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
            },
            version,
          );
          return;
        }

        // El servicio de rutas falló para este vehículo (servidor caído,
        // perfil no disponible, sin conexión): respaldo en línea recta en
        // vez de dejar la app sin ruta actualizada.
        if (version !== get().routeVersion) return; // ya hay algo más reciente
        const order = optimizeOrder(origin, pending);
        let prev: LatLng = origin;
        const ordered = order.map((i) => {
          const stop = { ...pending[i], legKm: haversineKm(prev, pending[i]) };
          prev = stop;
          return stop;
        });
        const km = ordered.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
        get().applyOptimization(
          { ordered, origin, km, durationMin: null, geometry: null, byStreets: false },
          version,
        );
        toast(
          "Sin conexión al servicio de rutas para este vehículo: orden calculado en línea recta.",
          { icon: "⚠️", className: "rht rht--error" },
        );
      },

      beginRouteRequest: () => {
        const version = get().routeVersion + 1;
        set({ routeVersion: version });
        return version;
      },

      applyOptimization: (
        { ordered, origin, km, durationMin, geometry, byStreets },
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
        });
      },
    }),
    { name: "rutafacil-route" },
  ),
);
