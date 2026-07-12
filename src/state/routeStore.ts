import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LatLng } from "../lib/geo";
import { optimizeOrder, pathLengthKm } from "../lib/tsp";

export interface Stop {
  id: string;
  lat: number;
  lng: number;
  label: string;
  delivered: boolean;
  createdAt: number;
}

interface RouteState {
  stops: Stop[];
  /** null = la ruta aún no se ha optimizado desde la última modificación */
  optimizedKm: number | null;
  origin: LatLng | null;
  addStop: (lat: number, lng: number, label?: string) => void;
  removeStop: (id: string) => void;
  renameStop: (id: string, label: string) => void;
  toggleDelivered: (id: string) => void;
  clearRoute: () => void;
  optimize: (origin: LatLng) => void;
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      stops: [],
      optimizedKm: null,
      origin: null,

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
          optimizedKm: null,
        })),

      removeStop: (id) =>
        set((s) => ({
          stops: s.stops.filter((st) => st.id !== id),
          optimizedKm: null,
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

      clearRoute: () => set({ stops: [], optimizedKm: null, origin: null }),

      optimize: (origin) => {
        const { stops } = get();
        // Las entregadas quedan al frente (ya pasaste); se optimiza el resto
        const pending = stops.filter((s) => !s.delivered);
        const done = stops.filter((s) => s.delivered);
        const order = optimizeOrder(origin, pending);
        const ordered = order.map((i) => pending[i]);
        set({
          stops: [...done, ...ordered],
          origin,
          optimizedKm: pathLengthKm(origin, ordered),
        });
      },
    }),
    { name: "rutafacil-route" },
  ),
);
