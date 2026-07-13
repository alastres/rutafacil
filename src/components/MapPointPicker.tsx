import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "../lib/geo";
import { PinIcon } from "./icons";

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

/** Selector de ubicación: el mapa se mueve, el pin queda fijo en el centro
 * de la pantalla. Al confirmar se lee el centro actual del mapa — evita
 * tener que implementar detección de clics/hit-testing sobre el mapa. */
export function MapPointPicker({
  initial,
  onConfirm,
  onCancel,
}: {
  initial?: LatLng;
  onConfirm: (point: LatLng) => void;
  onCancel: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const centerRef = useRef<LatLng>(initial ?? { lat: 4.6, lng: -74.08 });
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const start = centerRef.current;
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: [start.lng, start.lat],
      zoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const onMove = () => {
      const c = map.getCenter();
      centerRef.current = { lat: c.lat, lng: c.lng };
      forceRender((n) => n + 1);
    };
    map.on("move", onMove);
    return () => {
      map.off("move", onMove);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="point-picker">
      <div className="point-picker__map" ref={container} />
      <div className="point-picker__pin" aria-hidden="true">
        <PinIcon size={30} />
      </div>
      <div className="point-picker__coords">
        {centerRef.current.lat.toFixed(5)}, {centerRef.current.lng.toFixed(5)}
      </div>
      <div className="point-picker__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-nav"
          onClick={() => onConfirm(centerRef.current)}
        >
          Usar este punto
        </button>
      </div>
    </div>
  );
}
