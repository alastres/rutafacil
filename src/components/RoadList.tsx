import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { googleMapsNavUrl } from "../lib/nav";
import { haversineKm } from "../lib/geo";
import { useRouteStore, type Stop } from "../state/routeStore";
import { CheckIcon, CloseIcon, ArrowRightIcon, PinIcon, DragHandleIcon } from "./icons";

export function RoadList({ moving }: { moving: boolean }) {
  const stops = useRouteStore((s) => s.stops);
  const reorderStops = useRouteStore((s) => s.reorderStops);
  const optimizedKm = useRouteStore((s) => s.optimizedKm);
  const byStreets = useRouteStore((s) => s.byStreets);
  const origin = useRouteStore((s) => s.origin);
  const live = useRouteStore((s) => s.live);
  const returnPoint = useRouteStore((s) => s.returnPoint);
  const returnLegKm = useRouteStore((s) => s.returnLegKm);
  const optimized = optimizedKm !== null;
  const nextStop = stops.find((s) => !s.delivered);
  const nextId = nextStop?.id;

  const doneStops = stops.filter((s) => s.delivered);
  const pendingStops = stops.filter((s) => !s.delivered);

  // Distancia/ETA en vivo desde la posición GPS al siguiente punto
  let liveInfo: string | null = null;
  if (live && nextStop) {
    const km = haversineKm(live, nextStop) * 1.25; // factor urbano (calles + tránsito)
    const min = Math.round((km / 20) * 60);
    liveInfo = `a ${km.toFixed(1)} km · ~${min} min`;
  }

  return (
    <div className={`stop-list${moving ? " is-moving" : ""}`}>

      {/* Encabezado: punto de partida */}
      {optimized && origin && (
        <div className="stop-list-origin">
          <span className="sl-badge sl-badge--origin">TÚ</span>
          <div className="sl-origin-info">
            {live ? (
              <>Siguiendo en vivo · {liveInfo}</>
            ) : (
              <>Punto de partida · {byStreets ? "ruta por calles" : "línea recta"}</>
            )}
          </div>
        </div>
      )}

      {/* Paradas completadas */}
      <AnimatePresence initial={false}>
        {doneStops.length > 0 && (
          <div className="sl-section-label">
            <CheckIcon size={11} />
            Completadas ({doneStops.length})
          </div>
        )}
        {doneStops.map((stop, i) => (
          <StopItem key={stop.id} stop={stop} position={i + 1} />
        ))}
      </AnimatePresence>

      {/* Paradas pendientes */}
      {pendingStops.length > 0 && (
        <>
          {doneStops.length > 0 && (
            <div className="sl-section-label sl-section-label--pending">
              Pendientes ({pendingStops.length})
            </div>
          )}
          <Reorder.Group
            axis="y"
            values={pendingStops}
            onReorder={reorderStops}
            className="sl-pending-group"
            as="div"
          >
            {pendingStops.map((stop, j) => (
              <StopItemDraggable
                key={stop.id}
                stop={stop}
                position={doneStops.length + j + 1}
                isNext={stop.id === nextId && optimized}
                legKm={optimized ? stop.legKm : undefined}
              />
            ))}
          </Reorder.Group>
        </>
      )}

      {/* Punto de retorno */}
      {returnPoint && (
        <div className="sl-return-item">
          <span className="sl-badge sl-badge--return">
            <PinIcon size={12} />
          </span>
          <div className="sl-return-info">
            <span className="sl-return-label">Retorno · {returnPoint.label}</span>
            {optimized && returnLegKm !== null && (
              <span className="sl-return-km">+{returnLegKm.toFixed(1)} km</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Parada entregada — estática */
function StopItem({ stop, position }: { stop: Stop; position: number }) {
  const toggleDelivered = useRouteStore((s) => s.toggleDelivered);

  return (
    <motion.div
      layout
      className="sl-item sl-item--done"
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className="sl-badge sl-badge--done">
        <CheckIcon size={13} />
      </span>
      <article className="sl-card sl-card--done">
        <div className="sl-card-meta">Parada {position}</div>
        <div className="sl-card-label">{stop.label}</div>
        <button
          className="sl-stamp"
          onClick={() => toggleDelivered(stop.id)}
          title="Tocar para deshacer"
        >
          <CheckIcon size={11} /> Entregada
        </button>
      </article>
    </motion.div>
  );
}

/** Parada pendiente — arrastrable */
function StopItemDraggable({
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
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={stop}
      id={stop.id}
      dragListener={false}
      dragControls={dragControls}
      className={`sl-item${isNext ? " sl-item--next" : ""}`}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className="sl-badge sl-badge--num">{position}</span>

      <article className={`sl-card${isNext ? " sl-card--next" : ""}`}>
        <div className="sl-card-top">
          <div className="sl-card-meta">
            {isNext ? <strong className="sl-next-tag">Siguiente</strong> : `Parada ${position}`}
            {legKm !== undefined && <span className="sl-leg-km">+{legKm.toFixed(1)} km</span>}
          </div>
          <button
            className="sl-drag-handle"
            onPointerDown={(e) => dragControls.start(e)}
            title="Arrastrar para cambiar orden"
            style={{ touchAction: "none" }}
            aria-label="Arrastrar parada"
          >
            <DragHandleIcon size={14} />
          </button>
        </div>

        <div className="sl-card-row">
          <input
            className="sl-card-label-input"
            value={stop.label}
            onChange={(e) => renameStop(stop.id, e.target.value)}
            aria-label={`Nombre de la parada ${position}`}
          />
          <button
            className="sl-remove-btn"
            onClick={() => removeStop(stop.id)}
            aria-label={`Quitar ${stop.label}`}
          >
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="sl-card-actions">
          <a
            className="sl-btn sl-btn--nav"
            href={googleMapsNavUrl(stop)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Navegar <ArrowRightIcon size={13} />
          </a>
          <button
            className="sl-btn sl-btn--done"
            onClick={() => toggleDelivered(stop.id)}
          >
            Entregada <CheckIcon size={13} />
          </button>
        </div>
      </article>
    </Reorder.Item>
  );
}
