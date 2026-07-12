import { describe, expect, it } from "vitest";
import { parseAllLocations, parseSharedText } from "./parse";

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

describe("parseAllLocations", () => {
  it("extrae varias ubicaciones de una conversación pegada", () => {
    const chat = [
      "[9:02] Cliente 1: https://maps.google.com/?q=4.6486,-74.0628",
      "[9:15] Cliente 2: mi casa está en 4.7010, -74.0470",
      "[9:31] Cliente 3: geo:4.6097,-74.0817",
    ].join("\n");
    const r = parseAllLocations(chat);
    expect(r.locations).toHaveLength(3);
    expect(r.locations[1]).toMatchObject({ lat: 4.701, lng: -74.047 });
    expect(r.shortLinks).toHaveLength(0);
  });

  it("separa los enlaces acortados para resolverlos aparte", () => {
    const r = parseAllLocations(
      "https://maps.app.goo.gl/AbC123 y también 4.6486, -74.0628",
    );
    expect(r.locations).toHaveLength(1);
    expect(r.shortLinks).toEqual(["https://maps.app.goo.gl/AbC123"]);
  });

  it("no duplica la misma coordenada repetida", () => {
    const r = parseAllLocations(
      "https://maps.google.com/?q=4.6486,-74.0628\nhttps://maps.google.com/?q=4.6486,-74.0628",
    );
    expect(r.locations).toHaveLength(1);
  });

  it("devuelve vacío para texto sin ubicaciones", () => {
    const r = parseAllLocations("hola, ¿a qué hora llegas?");
    expect(r.locations).toHaveLength(0);
    expect(r.shortLinks).toHaveLength(0);
  });

  it("conserva las etiquetas de /maps/place/ en modo masivo", () => {
    const r = parseAllLocations(
      "https://www.google.com/maps/place/Panader%C3%ADa+La+Espiga/@4.6,-74.08,17z",
    );
    expect(r.locations[0].label).toBe("Panadería La Espiga");
  });
});
