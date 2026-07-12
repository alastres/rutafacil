import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouteStore } from "../state/routeStore";

/** Mapa con teselas de OpenStreetMap: sin llaves de API ni costo. */
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
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
      style: OSM_STYLE,
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
