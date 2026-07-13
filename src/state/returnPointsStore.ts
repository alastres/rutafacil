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
