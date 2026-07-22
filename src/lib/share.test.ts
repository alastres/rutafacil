import { describe, it, expect } from "vitest";
import { formatCurrency, generateSingleRouteReport, generateBatchRouteReport, generateWhatsAppDispatchText } from "./share";
import type { RouteHistoryRecord } from "./historyDb";

describe("share.ts", () => {
  it("formats currency correctly", () => {
    expect(formatCurrency(50000)).toBe("$50.000");
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(null)).toBe("$0");
  });

  it("generates single route report with financial totals", () => {
    const record: RouteHistoryRecord = {
      id: "r1",
      createdAt: 1700000000000,
      updatedAt: 1700003600000,
      trackingStartedAt: 1700000000000,
      completedAt: 1700003600000,
      label: "Ruta Pruebas",
      mode: "car",
      stopsTotal: 2,
      stopsDelivered: 2,
      distanceKm: 10.5,
      elapsedMs: 3600000,
      status: "completed",
      stops: [
        { id: "s1", lat: 4.6, lng: -74.0, label: "Parada 1", delivered: true, deliveredAt: 1700001800000, collectAmount: 30000, travelAllowance: 5000 },
        { id: "s2", lat: 4.6, lng: -74.0, label: "Parada 2", delivered: true, deliveredAt: 1700003600000, collectAmount: 20000, travelAllowance: 3000, notes: "Cambio 50k" },
      ],
    };

    const report = generateSingleRouteReport(record);
    expect(report).toContain("Ruta Pruebas");
    expect(report).toContain("$50.000"); // Total cobrado
    expect(report).toContain("$8.000");  // Total viáticos
    expect(report).toContain("$42.000"); // Balance neto
    expect(report).toContain("Cambio 50k");
  });

  it("generates batch route report for multiple routes", () => {
    const r1: RouteHistoryRecord = {
      id: "r1",
      createdAt: 1700000000000,
      updatedAt: 1700003600000,
      trackingStartedAt: null,
      completedAt: null,
      label: "Ruta 1",
      mode: "car",
      stopsTotal: 1,
      stopsDelivered: 1,
      distanceKm: 10,
      elapsedMs: 1800000,
      status: "completed",
      stops: [{ id: "s1", lat: 4.6, lng: -74.0, label: "P1", delivered: true, collectAmount: 40000, travelAllowance: 5000 }],
    };

    const r2: RouteHistoryRecord = {
      id: "r2",
      createdAt: 1700004000000,
      updatedAt: 1700007600000,
      trackingStartedAt: null,
      completedAt: null,
      label: "Ruta 2",
      mode: "bike",
      stopsTotal: 1,
      stopsDelivered: 1,
      distanceKm: 15,
      elapsedMs: 3600000,
      status: "completed",
      stops: [{ id: "s2", lat: 4.6, lng: -74.0, label: "P2", delivered: true, collectAmount: 60000, travelAllowance: 10000 }],
    };

    const batchReport = generateBatchRouteReport([r1, r2]);
    expect(batchReport).toContain("CONSOLIDADO GLOBAL DE DESPACHOS (2 RUTAS)");
    expect(batchReport).toContain("25.0 km"); // Total km
    expect(batchReport).toContain("$100.000"); // Total cobrado
    expect(batchReport).toContain("$15.000");  // Total viáticos
    expect(batchReport).toContain("$85.000");  // Balance neto acumulado
  });

  it("generates WhatsApp dispatch text for delivery and pickup", () => {
    const deliveryText = generateWhatsAppDispatchText({
      geoUrl: "https://rutafacil.app/?geo=4.6,-74.0&cobro=50000",
      label: "Calle 10 #5-20",
      kind: "delivery",
      collectAmount: 50000,
      travelAllowance: 5000,
      notes: "Llevar sencillo",
      assignee: "Carlos",
    });

    expect(deliveryText).toContain("NUEVA ENTREGA ASIGNADA");
    expect(deliveryText).toContain("@Carlos");
    expect(deliveryText).toContain("Calle 10 #5-20");
    expect(deliveryText).toContain("$50.000");

    const pickupText = generateWhatsAppDispatchText({
      geoUrl: "https://rutafacil.app/?geo=4.6,-74.0&kind=pickup&cobro=35000",
      label: "[Recogida] Bodega Central",
      kind: "pickup",
      collectAmount: 35000,
      travelAllowance: 5000,
      notes: "Reclamar orden #4092",
      assignee: "Juan",
    });

    expect(pickupText).toContain("NUEVA RECOGIDA ASIGNADA");
    expect(pickupText).toContain("Recoger del cliente");
    expect(pickupText).toContain("Reclamar orden #4092");
  });
});
