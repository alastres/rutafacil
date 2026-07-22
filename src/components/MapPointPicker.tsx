import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getPosition, type LatLng } from "../lib/geo";
import { PinIcon } from "./icons";

const FALLBACK_CENTER: LatLng = { lat: 4.6, lng: -74.08 };

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
  const centerRef = useRef<LatLng>(initial ?? FALLBACK_CENTER);
  const [, forceRender] = useState(0);
  // Sin ubicación ya elegida, arranca buscando el GPS del usuario en vez de
  // dejarlo parado en un punto fijo del mundo.
  const [locating, setLocating] = useState(!initial);

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
    let userMoved = false;
    const onMove = () => {
      const c = map.getCenter();
      if (c && typeof c.lat === "number" && typeof c.lng === "number" && !isNaN(c.lat) && !isNaN(c.lng)) {
        centerRef.current = { lat: c.lat, lng: c.lng };
        setLocating(false);
        forceRender((n) => n + 1);
      }
    };
    const markUserMoved = () => {
      userMoved = true;
    };
    map.on("move", onMove);
    // Marca el gesto ANTES de que se dispare "move", para que el jumpTo del
    // GPS (si llega justo después) sepa que ya no debe pisarlo.
    map.on("dragstart", markUserMoved);
    map.on("wheel", markUserMoved);
    map.on("touchstart", markUserMoved);

    if (!initial) {
      getPosition()
        .then((pos) => {
          // Si el mapa ya se desmontó o el usuario ya empezó a moverlo
          // mientras se resolvía el GPS, no le pisamos el gesto.
          if (mapRef.current !== map || userMoved) return;
          centerRef.current = pos;
          map.jumpTo({ center: [pos.lng, pos.lat] });
          forceRender((n) => n + 1);
        })
        .catch(() => {})
        .finally(() => setLocating(false));
    }

    return () => {
      map.off("move", onMove);
      map.off("dragstart", markUserMoved);
      map.off("wheel", markUserMoved);
      map.off("touchstart", markUserMoved);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="point-picker"
      onTouchStart={(e) => {
        if (e.touches.length > 1) {
          e.stopPropagation();
        }
      }}
    >
      <div className="point-picker__map" ref={container} />
      <div className="point-picker__pin" aria-hidden="true">
        <PinIcon size={30} />
      </div>
      <div className="point-picker__coords">
        {locating
          ? "Buscando tu ubicación…"
          : typeof centerRef.current?.lat === "number" && !isNaN(centerRef.current.lat)
          ? `${centerRef.current.lat.toFixed(5)}, ${centerRef.current.lng.toFixed(5)}`
          : "Fijando ubicación…"}
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
