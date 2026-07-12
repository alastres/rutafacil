import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LatLng } from "../lib/geo";

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
  addStop: (lat: number, lng: number, label?: string) => void;
  removeStop: (id: string) => void;
  renameStop: (id: string, label: string) => void;
  toggleDelivered: (id: string) => void;
  clearRoute: () => void;
  applyOptimization: (result: OptimizationResult) => void;
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
        set({ stops: [], origin: null, byStreets: false, ...invalidated }),

      applyOptimization: ({ ordered, origin, km, durationMin, geometry, byStreets }) => {
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
