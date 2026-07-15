import { afterEach, describe, expect, it, vi } from "vitest";
import type { LatLng } from "./geo";
import { tripThroughStreets } from "./routing";

const origin: LatLng = { lat: 4.6, lng: -74.08 };
const stops: LatLng[] = [
  { lat: 4.61, lng: -74.08 },
  { lat: 4.62, lng: -74.08 },
];
const returnPoint: LatLng = { lat: 4.55, lng: -74.03 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tripThroughStreets — punto de retorno", () => {
  it("agrega el punto de retorno como última coordenada y pide destination=last", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            order: [0, 1],
            legsKm: [1, 1],
            distanceKm: 4,
            durationMin: 10,
            coordinates: [[-74.08, 4.6]],
            returnLegKm: 2,
          }),
        };
      }),
    );

    const result = await tripThroughStreets(origin, stops, { returnPoint });

    expect(capturedUrl).toBe("/api/route");
    expect(capturedBody.returnPoint).toEqual(returnPoint);
    expect(result?.returnLegKm).toBeCloseTo(2, 6);
    expect(result?.legsKm).toEqual([1, 1]);
  });

  it("sin punto de retorno, pide destination=any y no agrega tramo extra", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            order: [0, 1],
            legsKm: [1, 1],
            distanceKm: 2,
            durationMin: 10,
            coordinates: [[-74.08, 4.6]],
          }),
        };
      }),
    );

    const result = await tripThroughStreets(origin, stops);

    expect(capturedUrl).toBe("/api/route");
    expect(capturedBody.returnPoint).toBeUndefined();
    expect(result?.returnLegKm).toBeUndefined();
  });

  it("con optimize = false, usa el endpoint /route/v1 y no reordena las paradas", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            order: [0, 1],
            legsKm: [1, 2],
            distanceKm: 3,
            durationMin: 10,
            coordinates: [[-74.08, 4.6]],
          }),
        };
      }),
    );

    const result = await tripThroughStreets(origin, stops, { optimize: false });

    expect(capturedUrl).toBe("/api/route");
    expect(capturedBody.optimize).toBe(false);
    expect(result?.order).toEqual([0, 1]);
    expect(result?.legsKm).toEqual([1, 2]);
    expect(result?.distanceKm).toBe(3);
  });
});
