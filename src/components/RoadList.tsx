import { AnimatePresence, motion } from "motion/react";
import { googleMapsNavUrl } from "../lib/nav";
import { haversineKm } from "../lib/geo";
import { useRouteStore, type Stop } from "../state/routeStore";

export function RoadList({ moving }: { moving: boolean }) {
  const stops = useRouteStore((s) => s.stops);
  const optimizedKm = useRouteStore((s) => s.optimizedKm);
  const byStreets = useRouteStore((s) => s.byStreets);
  const origin = useRouteStore((s) => s.origin);
  const live = useRouteStore((s) => s.live);
  const optimized = optimizedKm !== null;
  const nextStop = stops.find((s) => !s.delivered);
  const nextId = nextStop?.id;

  // Distancia/ETA en vivo desde la posición GPS al siguiente punto
  let liveInfo: string | null = null;
  if (live && nextStop) {
    const km = haversineKm(live, nextStop) * 1.25; // factor urbano (calles + tránsito)
    const min = Math.round((km / 20) * 60);
    liveInfo = `a ${km.toFixed(1)} km · ~${min} min`;
  }

  return (
    <ol className={`road-list${moving ? " is-moving" : ""}`}>
      {optimized && origin && (
        <li className="road-item road-origin" aria-label="Punto de partida">
          <span className="marker marker-origin" aria-hidden="true">
            TÚ
          </span>
          <div className="origin-chip">
            {live ? (
              <>
                Siguiendo en vivo · {liveInfo}
              </>
            ) : (
              <>
                Punto de partida · {byStreets ? "ruta por calles" : "línea recta"}
              </>
            )}
          </div>
        </li>
      )}
      <AnimatePresence initial={false}>
        {stops.map((stop, i) => (
          <StopItem
            key={stop.id}
            stop={stop}
            position={i + 1}
            isNext={stop.id === nextId && optimized}
            legKm={optimized ? stop.legKm : undefined}
          />
        ))}
      </AnimatePresence>
    </ol>
  );
}

function StopItem({
  stop,
  position,
  isNext,
  legKm,
}: {
  stop: Stop;
  position: number;
  isNext: boolean;
  legKm?: number;
}) {
  const renameStop = useRouteStore((s) => s.renameStop);
  const removeStop = useRouteStore((s) => s.removeStop);
  const toggleDelivered = useRouteStore((s) => s.toggleDelivered);

  const classes = [
    "road-item",
    stop.delivered ? "is-delivered" : "",
    isNext ? "is-next" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.li
      layout
      className={classes}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className="marker" aria-hidden="true">
        {stop.delivered ? "✓" : position}
      </span>
      <article className="stop-card">
        <div className="stop-eyebrow">
          {isNext ? <strong>Siguiente</strong> : <span>Parada {position}</span>}
          {legKm !== undefined && !stop.delivered && (
            <span>+{legKm.toFixed(1)} km</span>
          )}
        </div>
        <div className="stop-row">
          <input
            className="stop-label"
            value={stop.label}
            onChange={(e) => renameStop(stop.id, e.target.value)}
            aria-label={`Nombre de la parada ${position}`}
          />
          <button
            className="stop-remove"
            onClick={() => removeStop(stop.id)}
            aria-label={`Quitar ${stop.label}`}
          >
            ✕
          </button>
        </div>
        {!stop.delivered && (
          <div className="stop-actions">
            <a
              className="btn btn-nav"
              href={googleMapsNavUrl(stop)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Navegar ➜
            </a>
            <button
              className="btn btn-done"
              onClick={() => toggleDelivered(stop.id)}
            >
              Entregada ✓
            </button>
          </div>
        )}
        {stop.delivered && (
          <motion.button
            className="stamp"
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={() => toggleDelivered(stop.id)}
            initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 16 }}
            title="Tocar para deshacer"
          >
            Entregado
          </motion.button>
        )}
      </article>
    </motion.li>
  );
}
