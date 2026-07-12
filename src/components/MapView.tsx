import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouteStore } from "../state/routeStore";

/**
 * Mapa base con Esri World Street Map: calles muy detalladas y actualizadas
 * (datos comerciales), sin API key. Sustituye a las teselas de OSM, que pueden
 * no mostrar calles recientes o locales. El ruteo sigue por OSRM (datos OSM).
 * Esri exige su atribución.
 */
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
      attribution:
        "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
};

export default function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const stops = useRouteStore((s) => s.stops);
  const origin = useRouteStore((s) => s.origin);
  const geometry = useRouteStore((s) => s.geometry);
  const byStreets = useRouteStore((s) => s.byStreets);

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
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#F7C600",
          "line-width": 4,
        },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: { "line-color": "#211E1A", "line-width": 7 },
      }, "route-line");
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = stops.map((stop, i) => {
      const el = document.createElement("div");
      el.className = `map-marker${stop.delivered ? " is-delivered" : ""}`;
      el.textContent = stop.delivered ? "✓" : String(i + 1);
      return new maplibregl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);
    });
    if (origin) {
      const el = document.createElement("div");
      el.className = "map-marker is-origin";
      el.textContent = "TÚ";
      markersRef.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map),
      );
    }

    const updateLine = () => {
      const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      // Con ruta por calles se pinta la geometría real; si no, la unión
      // recta entre paradas como referencia
      const coordinates =
        geometry ??
        stops.filter((s) => !s.delivered).map((s) => [s.lng, s.lat] as [number, number]);
      source?.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {},
      });
      if (map.getLayer("route-line")) {
        map.setPaintProperty(
          "route-line",
          "line-dasharray",
          byStreets ? [1, 0] : [2, 1.5],
        );
      }
    };
    if (map.isStyleLoaded()) updateLine();
    else map.once("load", updateLine);

    if (stops.length > 0 || origin) {
      const bounds = new maplibregl.LngLatBounds();
      stops.forEach((s) => bounds.extend([s.lng, s.lat]));
      if (origin) bounds.extend([origin.lng, origin.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 600 });
    }
  }, [stops, origin, geometry, byStreets]);

  return <div className="map-wrap" ref={container} />;
}
