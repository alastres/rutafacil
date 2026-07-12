import { describe, expect, it } from "vitest";
import type { LatLng } from "./geo";
import { optimizeOrder, pathLengthKm } from "./tsp";

const origin: LatLng = { lat: 4.6, lng: -74.08 };

describe("optimizeOrder", () => {
  it("devuelve vacío sin paradas", () => {
    expect(optimizeOrder(origin, [])).toEqual([]);
  });

  it("ordena una línea de paradas de cerca a lejos", () => {
    // Paradas sobre un mismo eje, desordenadas: la ruta óptima es recorrerlas en orden
    const stops: LatLng[] = [
      { lat: 4.63, lng: -74.08 }, // lejos
      { lat: 4.61, lng: -74.08 }, // cerca
      { lat: 4.62, lng: -74.08 }, // medio
    ];
    expect(optimizeOrder(origin, stops)).toEqual([1, 2, 0]);
  });

  it("nunca es peor que el orden original", () => {
    const stops: LatLng[] = Array.from({ length: 12 }, (_, i) => ({
      lat: 4.6 + Math.sin(i * 2.399) * 0.05,
      lng: -74.08 + Math.cos(i * 2.399) * 0.05,
    }));
    const order = optimizeOrder(origin, stops);
    const optimized = pathLengthKm(origin, order.map((i) => stops[i]));
    const original = pathLengthKm(origin, stops);
    expect(optimized).toBeLessThanOrEqual(original + 1e-9);
    // y visita todas las paradas exactamente una vez
    expect([...order].sort((a, b) => a - b)).toEqual(stops.map((_, i) => i));
  });
});
