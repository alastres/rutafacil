import { describe, it, expect } from "vitest";
import { generateGpx } from "./gpx";

describe("gpx", () => {
  it("debe generar un XML GPX válido con paradas y origen", () => {
    const stops = [
      { lat: 4.6097, lng: -74.0817, label: "Calle 10 & Cra 7" },
      { lat: 4.6500, lng: -74.0500, label: 'Parada "Especial" <Test>' },
    ];
    const origin = { lat: 4.6000, lng: -74.0900 };

    const xml = generateGpx(stops, origin, "Mi Ruta Especial");

    expect(xml).toContain('creator="RutaFácil');
    expect(xml).toContain('<wpt lat="4.6097" lon="-74.0817">');
    expect(xml).toContain("<name>Origen (Tú)</name>");
    expect(xml).toContain("Parada 1: Calle 10 &amp; Cra 7");
    expect(xml).toContain("Parada &quot;Especial&quot; &lt;Test&gt;");
    expect(xml).toContain("<rte>");
    expect(xml).toContain("</gpx>");
  });

  it("excluye paradas entregadas del archivo GPX", () => {
    const stops = [
      { lat: 4.6097, lng: -74.0817, label: "Entregada 1", delivered: true },
      { lat: 4.6500, lng: -74.0500, label: "Pendiente 2", delivered: false },
    ];

    const xml = generateGpx(stops);

    expect(xml).not.toContain("Entregada 1");
    expect(xml).toContain("Pendiente 2");
  });
});
