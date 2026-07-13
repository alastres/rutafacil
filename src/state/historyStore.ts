import { create } from "zustand";
import { listRoutes, deleteRoute, putRoute, type RouteHistoryRecord } from "../lib/historyDb";

interface HistoryState {
  records: RouteHistoryRecord[];
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Renombra una ruta que YA NO es la activa (esa se renombra vía routeStore.setHistoryLabel). */
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  loaded: false,

  refresh: async () => {
    const records = await listRoutes();
    set({ records, loaded: true });
  },

  rename: async (id, label) => {
    const record = get().records.find((r) => r.id === id);
    if (!record) return;
    await putRoute({ ...record, label, updatedAt: Date.now() });
    await get().refresh();
  },

  remove: async (id) => {
    await deleteRoute(id);
    await get().refresh();
  },
}));
