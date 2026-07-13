import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CHECK_SVG_MARKUP, PIN_SVG_MARKUP } from "./icons";
import type { HistoryStop } from "../lib/historyDb";

/** Mismo estilo base que el mapa principal, para que el detalle se vea
 * coherente con el resto de la app. */
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
};

/** Mapa de solo lectura para la vista de detalle de una ruta guardada: no
 * depende de routeStore, recibe los datos directamente del registro. */
export default function RouteDetailMap({
  stops,
  geometry,
  origin,
  returnPoint,
}: {
  stops: HistoryStop[];
  geometry: [number, number][] | null | undefined;
  origin: { lat: number; lng: number } | null | undefined;
  returnPoint: { lat: number; lng: number; label: string } | null | undefined;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: [-74.08, 4.6],
      zoom: 11,
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      const validStops = stops.filter(
        (s) => Number.isFinite(s.lng) && Number.isFinite(s.lat),
      );
      const hasStreetGeometry = !!geometry && geometry.length > 0;
      const lineCoords: [number, number][] = hasStreetGeometry
        ? (geometry as [number, number][])
        : [
            ...(origin && Number.isFinite(origin.lng) && Number.isFinite(origin.lat)
              ? [[origin.lng, origin.lat] as [number, number]]
              : []),
            ...validStops.map((s) => [s.lng, s.lat] as [number, number]),
            ...(returnPoint && Number.isFinite(returnPoint.lng) && Number.isFinite(returnPoint.lat)
              ? [[returnPoint.lng, returnPoint.lat] as [number, number]]
              : []),
          ];

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: lineCoords }, properties: {} },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: { "line-color": "#211E1A", "line-width": 7 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#F7C600",
          "line-width": 4,
          "line-dasharray": hasStreetGeometry ? [1, 0] : [2, 1.5],
        },
      });

      const bounds = new maplibregl.LngLatBounds();
      validStops.forEach((s, i) => {
        const el = document.createElement("div");
        el.className = `map-marker${s.delivered ? " is-delivered" : ""}`;
        if (s.delivered) el.innerHTML = CHECK_SVG_MARKUP;
        else el.textContent = String(i + 1);
        new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
        bounds.extend([s.lng, s.lat]);
      });
      if (origin && Number.isFinite(origin.lng) && Number.isFinite(origin.lat)) {
        const el = document.createElement("div");
        el.className = "map-marker is-origin";
        el.textContent = "TÚ";
        new maplibregl.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map);
        bounds.extend([origin.lng, origin.lat]);
      }
      if (returnPoint && Number.isFinite(returnPoint.lng) && Number.isFinite(returnPoint.lat)) {
        const el = document.createElement("div");
        el.className = "map-marker is-return";
        el.innerHTML = PIN_SVG_MARKUP;
        new maplibregl.Marker({ element: el }).setLngLat([returnPoint.lng, returnPoint.lat]).addTo(map);
        bounds.extend([returnPoint.lng, returnPoint.lat]);
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 });
      }
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="map-wrap" ref={container} />;
}
