import { create } from "zustand";

interface LoadingState {
  /** Nº de llamadas asíncronas en curso; > 0 = mostrar el loader global. */
  count: number;
  start: () => void;
  stop: () => void;
}

/**
 * Contador global de operaciones asíncronas en vuelo (peticiones de red,
 * geolocalización). Cualquier llamada que tarde de forma perceptible debe
 * envolverse con `withLoader` para que la barra de carga superior aparezca.
 * Un contador (no un booleano) porque varias llamadas pueden solaparse
 * (p. ej. resolver dos enlaces cortos a la vez): solo se oculta cuando la
 * última termina.
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  count: 0,
  start: () => set((s) => ({ count: s.count + 1 })),
  stop: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}));

/** Envuelve una promesa para que el loader global se muestre mientras esté pendiente. */
export async function withLoader<T>(fn: () => Promise<T>): Promise<T> {
  useLoadingStore.getState().start();
  try {
    return await fn();
  } finally {
    useLoadingStore.getState().stop();
  }
}
