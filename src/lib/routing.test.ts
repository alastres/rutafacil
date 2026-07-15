import { afterEach, describe, expect, it, vi } from "vitest";
import type { LatLng } from "./geo";
import { tripThroughStreets } from "./routing";

const origin: LatLng = { lat: 4.6, lng: -74.08 };
const stops: LatLng[] = [
  { lat: 4.61, lng: -74.08 },
  { lat: 4.62, lng: -74.08 },
];
const returnPoint: LatLng = { lat: 4.55, lng: -74.03 };

function osrmResponse(waypointOrder: number[], legDistancesM: number[]) {
  return {
    code: "Ok",
    trips: [
      {
        distance: legDistancesM.reduce((a, b) => a + b, 0),
        duration: 600,
        geometry: { coordinates: [[-74.08, 4.6]] },
        legs: legDistancesM.map((distance) => ({ distance, duration: 60 })),
      },
    ],
    waypoints: waypointOrder.map((waypoint_index) => ({ waypoint_index })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tripThroughStreets — punto de retorno", () => {
  it("agrega el punto de retorno como última coordenada y pide destination=last", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        // orden del viaje: origen(0), parada1(1), parada2(2), retorno(3)
        return {
          ok: true,
          json: async () => osrmResponse([0, 1, 2, 3], [1000, 1000, 2000]),
        };
      }),
    );

    const result = await tripThroughStreets(origin, stops, { returnPoint });

    expect(capturedUrl).toContain("destination=last");
    expect(capturedUrl.split(";").length).toBe(4);
    expect(capturedUrl).toContain(`${returnPoint.lng},${returnPoint.lat}`);
    expect(result?.returnLegKm).toBeCloseTo(2, 6);
    expect(result?.legsKm).toEqual([1, 1]);
  });

  it("sin punto de retorno, pide destination=any y no agrega tramo extra", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return { ok: true, json: async () => osrmResponse([0, 1, 2], [1000, 1000]) };
      }),
    );

    const result = await tripThroughStreets(origin, stops);

    expect(capturedUrl).toContain("destination=any");
    expect(capturedUrl.split(";").length).toBe(3);
    expect(result?.returnLegKm).toBeUndefined();
  });

  it("con optimize = false, usa el endpoint /route/v1 y no reordena las paradas", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            code: "Ok",
            routes: [
              {
                distance: 3000,
                duration: 600,
                geometry: { coordinates: [[-74.08, 4.6]] },
                legs: [
                  { distance: 1000, duration: 200 },
                  { distance: 2000, duration: 400 },
                ],
              },
            ],
          }),
        };
      }),
    );

    const result = await tripThroughStreets(origin, stops, { optimize: false });

    expect(capturedUrl).toContain("/route/v1/");
    expect(capturedUrl).not.toContain("/trip/v1/");
    expect(result?.order).toEqual([0, 1]);
    expect(result?.legsKm).toEqual([1, 2]);
    expect(result?.distanceKm).toBe(3);
  });
});
