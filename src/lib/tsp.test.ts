import { describe, expect, it } from "vitest";
import { haversineKm, type LatLng } from "./geo";
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

  it("mantiene fijo el punto de retorno al final", () => {
    const fixedEnd: LatLng = { lat: 4.7, lng: -74.08 };
    const stops: LatLng[] = [
      { lat: 4.63, lng: -74.08 }, // lejos
      { lat: 4.61, lng: -74.08 }, // cerca
      { lat: 4.62, lng: -74.08 }, // medio
    ];
    const order = optimizeOrder(origin, stops, fixedEnd);
    // visita las 3 paradas exactamente una vez; el punto de retorno no
    // pertenece a `stops`, así que nunca puede aparecer en el resultado
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    // el punto de retorno está mucho más lejos que cualquier parada, así
    // que no debería alterar el orden de cerca-a-lejos de las intermedias
    expect(order).toEqual([1, 2, 0]);
  });

  it("con punto de retorno, nunca es peor que el orden original", () => {
    const fixedEnd: LatLng = { lat: 4.55, lng: -74.03 };
    const stops: LatLng[] = Array.from({ length: 12 }, (_, i) => ({
      lat: 4.6 + Math.sin(i * 2.399) * 0.05,
      lng: -74.08 + Math.cos(i * 2.399) * 0.05,
    }));
    const order = optimizeOrder(origin, stops, fixedEnd);
    const optimized = pathLengthKm(origin, order.map((i) => stops[i]), fixedEnd);
    const original = pathLengthKm(origin, stops, fixedEnd);
    expect(optimized).toBeLessThanOrEqual(original + 1e-9);
    expect([...order].sort((a, b) => a - b)).toEqual(stops.map((_, i) => i));
  });
});

describe("pathLengthKm", () => {
  it("suma el tramo final cuando hay punto de retorno", () => {
    const stops: LatLng[] = [{ lat: 4.61, lng: -74.08 }];
    const fixedEnd: LatLng = { lat: 4.62, lng: -74.08 };
    const withEnd = pathLengthKm(origin, stops, fixedEnd);
    const withoutEnd = pathLengthKm(origin, stops);
    expect(withEnd).toBeGreaterThan(withoutEnd);
    expect(withEnd).toBeCloseTo(withoutEnd + haversineKm(stops[0], fixedEnd), 6);
  });
});
