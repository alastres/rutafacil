import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouteStore } from "../state/routeStore";
import { fetchIncidents } from "../lib/routing";
import { CHECK_SVG_MARKUP, PIN_SVG_MARKUP } from "./icons";

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY as string | undefined;
const EMPTY_FC = { type: "FeatureCollection", features: [] };

/** Mapa base con Esri World Street Map: calles muy detalladas y actualizadas
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
  const stopsMarkersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map());
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const returnMarkerRef = useRef<maplibregl.Marker | null>(null);
  const liveMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stops = useRouteStore((s) => s.stops);
  const origin = useRouteStore((s) => s.origin);
  const geometry = useRouteStore((s) => s.geometry);
  const byStreets = useRouteStore((s) => s.byStreets);
  const live = useRouteStore((s) => s.live);
  const tracking = useRouteStore((s) => s.tracking);
  const returnPoint = useRouteStore((s) => s.returnPoint);

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
      stopsMarkersRef.current.forEach(({ marker }) => marker.remove());
      stopsMarkersRef.current.clear();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      returnMarkerRef.current?.remove();
      returnMarkerRef.current = null;
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
    };
  }, []);

  // Paradas + línea de ruta + marcador de origen (oculto mientras se sigue en vivo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // --- Diffing de paradas ---
    const activeIds = new Set(stops.map((s) => s.id));
    const currentMap = stopsMarkersRef.current;

    // Eliminar marcadores de paradas borradas
    currentMap.forEach(({ marker }, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        currentMap.delete(id);
      }
    });

    // Crear o actualizar marcadores para paradas actuales
    stops.forEach((stop, i) => {
      const existing = currentMap.get(stop.id);
      const className = `map-marker${stop.delivered ? " is-delivered" : ""}`;
      const content = stop.delivered ? CHECK_SVG_MARKUP : String(i + 1);

      if (existing) {
        existing.marker.setLngLat([stop.lng, stop.lat]);
        if (existing.el.className !== className) {
          existing.el.className = className;
        }
        if (existing.el.innerHTML !== content && existing.el.textContent !== content) {
          if (stop.delivered) existing.el.innerHTML = content;
          else existing.el.textContent = content;
        }
      } else {
        const el = document.createElement("div");
        el.className = className;
        if (stop.delivered) el.innerHTML = content;
        else el.textContent = content;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);

        currentMap.set(stop.id, { marker, el });
      }
    });

    // --- Marcador de origen ---
    if (origin && !tracking) {
      if (originMarkerRef.current) {
        originMarkerRef.current.setLngLat([origin.lng, origin.lat]);
      } else {
        const el = document.createElement("div");
        el.className = "map-marker is-origin";
        el.textContent = "TÚ";
        originMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map);
      }
    } else {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    }

    // --- Marcador de retorno ---
    if (returnPoint) {
      if (returnMarkerRef.current) {
        returnMarkerRef.current.setLngLat([returnPoint.lng, returnPoint.lat]);
      } else {
        const el = document.createElement("div");
        el.className = "map-marker is-return";
        el.innerHTML = PIN_SVG_MARKUP;
        returnMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([returnPoint.lng, returnPoint.lat])
          .addTo(map);
      }
    } else {
      returnMarkerRef.current?.remove();
      returnMarkerRef.current = null;
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

    if (!tracking && (stops.length > 0 || origin)) {
      const bounds = new maplibregl.LngLatBounds();
      stops.forEach((s) => {
        if (Number.isFinite(s.lng) && Number.isFinite(s.lat)) {
          bounds.extend([s.lng, s.lat]);
        }
      });
      if (origin && Number.isFinite(origin.lng) && Number.isFinite(origin.lat)) {
        bounds.extend([origin.lng, origin.lat]);
      }
      if (returnPoint && Number.isFinite(returnPoint.lng) && Number.isFinite(returnPoint.lat)) {
        bounds.extend([returnPoint.lng, returnPoint.lat]);
      }
      try {
        // Cancela cualquier animación de cámara en curso (p. ej. un easeTo de
        // seguimiento) para no chocar con fitBounds y evitar "already running"
        map.stop();
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 600 });
      } catch {
        // Nunca debe romper la app por un ajuste de cámara
      }
    }
  }, [stops, origin, geometry, byStreets, tracking, returnPoint]);

  // Crea/quita el marcador "TÚ" en vivo según el estado de seguimiento.
  // Solo depende de `tracking` para NO destruirlo en cada fix de GPS.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || map !== mapRef.current) return;
    if (tracking) {
      // Posición inicial: la última conocida o el origen, para no parpadear en 0,0.
      // MapLibre exige una LngLat válida ANTES de addTo(): si se llama sin
      // setLngLat previo, Marker._update() lee lngLat.lng de undefined y
      // lanza — eso tumbaba el mapa entero en cuanto se activaba "Seguir".
      const seed = live ?? origin;
      if (!seed || !Number.isFinite(seed.lng) || !Number.isFinite(seed.lat)) {
        liveMarkerRef.current = null;
      } else {
        const el = document.createElement("div");
        el.className = "map-marker is-origin is-live";
        el.textContent = "TÚ";
        liveMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([seed.lng, seed.lat])
          .addTo(map);
      }
    } else {
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
    }
    return () => {
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
    };
  }, [tracking]);

  // Mueve el marcador a la posición en vivo, sigue la cámara (solo si el
  // usuario se sale del viewport, para no pelear con el paneo manual) y
  // actualiza dinámicamente el trayecto en amarillo recortando los tramos pasados.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || map !== mapRef.current) return;
    if (!live || !tracking) return;
    if (!Number.isFinite(live.lng) || !Number.isFinite(live.lat)) return;
    try {
      const pos = live;
      // Respaldo: si el marcador no se creó al activar el seguimiento
      // (p. ej. sin origen todavía), créalo en cuanto llegue el primer fix.
      if (!liveMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "map-marker is-origin is-live";
        el.textContent = "TÚ";
        liveMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map);
      }
      liveMarkerRef.current.setLngLat([pos.lng, pos.lat]);
      const follow = () => {
        if (map.isMoving() && !tracking) return;
        map.stop();
        map.easeTo({
          center: [pos.lng, pos.lat],
          zoom: tracking ? 16 : Math.max(map.getZoom(), 14),
          pitch: tracking ? 45 : 0,
          duration: 800,
        });
      };
      if (map.loaded()) {
        follow();
      } else {
        map.once("load", follow);
      }

      // Recorta el trayecto en amarillo que ya pasó
      const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        const fullCoordinates =
          geometry ??
          stops.filter((s) => !s.delivered).map((s) => [s.lng, s.lat] as [number, number]);

        if (fullCoordinates.length > 0) {
          // Encuentra el índice de la coordenada más cercana al usuario
          let minIndex = 0;
          let minDistance = Infinity;
          for (let i = 0; i < fullCoordinates.length; i++) {
            const [lng, lat] = fullCoordinates[i];
            const dx = lng - pos.lng;
            const dy = lat - pos.lat;
            const dist = dx * dx + dy * dy;
            if (dist < minDistance) {
              minDistance = dist;
              minIndex = i;
            }
          }
          const sliced = fullCoordinates.slice(minIndex);
          source.setData({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [[pos.lng, pos.lat], ...sliced],
            },
            properties: {},
          });
        }
      }
    } catch {
      // Nunca debe romper la app por un ajuste de seguimiento
    }
  }, [live, tracking, geometry, stops]);

  // Incidencias de tráfico (TomTom) — solo si hay llave configurada
  useEffect(() => {
    if (!TOMTOM_KEY) return;
    const map = mapRef.current;
    if (!map) return;

    const addLayer = () => {
      if (map.getSource("incidents")) return;
      map.addSource("incidents", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "incidents-layer",
        type: "circle",
        source: "incidents",
        paint: {
          "circle-radius": 7,
          "circle-color": "#d9481c",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.on("click", "incidents-layer", (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const coords = f.geometry.coordinates as [number, number];
        new maplibregl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(coords)
          .setHTML(
            `<strong>Incidencia</strong><br>${String(f.properties?.category ?? "")}`,
          )
          .addTo(map);
      });
    };

    const loadIncidents = async () => {
      const b = map.getBounds();
      const inc = await fetchIncidents({
        minLng: b.getWest(),
        minLat: b.getSouth(),
        maxLng: b.getEast(),
        maxLat: b.getNorth(),
      });
      const src = map.getSource("incidents") as maplibregl.GeoJSONSource | undefined;
      if (src && inc) {
        src.setData({
          type: "FeatureCollection",
          features: inc.map((i) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [i.lng, i.lat] },
            properties: { category: i.category },
          })),
        });
      }
    };

    let t: number | undefined;
    const onMoveEnd = () => {
      window.clearTimeout(t);
      t = window.setTimeout(loadIncidents, 600);
    };

    if (map.isStyleLoaded()) {
      addLayer();
      void loadIncidents();
    } else {
      map.once("load", () => {
        addLayer();
        void loadIncidents();
      });
    }
    map.on("moveend", onMoveEnd);

    return () => {
      map.off("moveend", onMoveEnd);
      window.clearTimeout(t);
    };
  }, []);

  return <div className="map-wrap" ref={container} />;
}
