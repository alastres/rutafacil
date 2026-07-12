import { describe, expect, it } from "vitest";
import { parseSharedText } from "./parse";

describe("parseSharedText", () => {
  it("entiende la ubicación de WhatsApp (geo:)", () => {
    const r = parseSharedText("geo:4.6486,-74.0628");
    expect(r).toMatchObject({ kind: "ok", lat: 4.6486, lng: -74.0628 });
  });

  it("entiende URLs de Google Maps con q=", () => {
    const r = parseSharedText("https://maps.google.com/?q=4.6486,-74.0628");
    expect(r).toMatchObject({ kind: "ok", lat: 4.6486, lng: -74.0628 });
  });

  it("prefiere el pin exacto (!3d!4d) sobre el centro del mapa (@)", () => {
    const r = parseSharedText(
      "https://www.google.com/maps/place/Panadería/@4.60,-74.08,17z/data=!3d4.6123!4d-74.0711",
    );
    expect(r).toMatchObject({ kind: "ok", lat: 4.6123, lng: -74.0711 });
  });

  it("extrae la etiqueta de /maps/place/", () => {
    const r = parseSharedText(
      "https://www.google.com/maps/place/Panader%C3%ADa+La+Espiga/@4.6,-74.08,17z",
    );
    expect(r).toMatchObject({ kind: "ok", label: "Panadería La Espiga" });
  });

  it("entiende coordenadas pegadas a mano", () => {
    const r = parseSharedText("4.6486, -74.0628");
    expect(r).toMatchObject({ kind: "ok", lat: 4.6486, lng: -74.0628 });
  });

  it("entiende enlaces de Waze", () => {
    const r = parseSharedText("https://waze.com/ul?ll=4.6486,-74.0628&navigate=yes");
    expect(r).toMatchObject({ kind: "ok", lat: 4.6486, lng: -74.0628 });
  });

  it("detecta enlaces acortados que no puede resolver", () => {
    const r = parseSharedText("Mira: https://maps.app.goo.gl/AbC123xyz");
    expect(r).toMatchObject({
      kind: "short-link",
      url: "https://maps.app.goo.gl/AbC123xyz",
    });
  });

  it("rechaza texto sin ubicación", () => {
    expect(parseSharedText("hola, ¿ya saliste?")).toEqual({ kind: "none" });
  });

  it("rechaza coordenadas fuera de rango", () => {
    expect(parseSharedText("99.9, -200.5")).toEqual({ kind: "none" });
  });
});
