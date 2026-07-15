import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { googleMapsNavUrl } from "../lib/nav";
import { haversineKm } from "../lib/geo";
import { useRouteStore, type Stop } from "../state/routeStore";
import { CheckIcon, CloseIcon, ArrowRightIcon, PinIcon, DragHandleIcon, LockIcon } from "./icons";

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
    <div className={`road-list${moving ? " is-moving" : ""}`}>
      {optimized && origin && (
        <div className="road-item road-origin" aria-label="Punto de partida">
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
        </div>
      )}

      <AnimatePresence initial={false}>
        {/* 1. Paradas entregadas (estáticas) */}
        {doneStops.map((stop, i) => (
          <StopItem
            key={stop.id}
            stop={stop}
            position={i + 1}
          />
        ))}
      </AnimatePresence>

      {/* 2. Paradas pendientes (arrastrables) */}
      {pendingStops.length > 0 && (
        <Reorder.Group
          axis="y"
          values={pendingStops}
          onReorder={reorderStops}
          className="road-list-pending"
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
      )}

      {returnPoint && (
        <div className="road-item road-return" aria-label="Punto de retorno">
          <span className="marker marker-return" aria-hidden="true">
            <PinIcon size={13} />
          </span>
          <div className="origin-chip">
            Punto de retorno · {returnPoint.label}
            {optimized && returnLegKm !== null && ` · +${returnLegKm.toFixed(1)} km`}
          </div>
        </div>
      )}
    </div>
  );
}

/** Componente para paradas ya entregadas (estático, sin arrastre) */
function StopItem({
  stop,
  position,
}: {
  stop: Stop;
  position: number;
}) {
  const toggleDelivered = useRouteStore((s) => s.toggleDelivered);

  return (
    <motion.div
      layout
      className="road-item is-delivered"
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className="marker" aria-hidden="true">
        <CheckIcon width={16} height={16} />
      </span>
      <article className="stop-card">
        <div className="stop-eyebrow">
          <span>Parada {position}</span>
        </div>
        <div className="stop-row">
          <span className="stop-label stop-label--delivered">{stop.label}</span>
        </div>
        <motion.button
          className="stamp"
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          onClick={() => toggleDelivered(stop.id)}
          initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 16 }}
          title="Tocar para deshacer"
        >
          <CheckIcon width={13} height={13} />
          Entregado
        </motion.button>
      </article>
    </motion.div>
  );
}

/** Componente para paradas pendientes (arrastrables) */
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
  const userTier = useRouteStore((s) => s.userTier);
  const setSubscriptionModalOpen = useRouteStore((s) => s.setSubscriptionModalOpen);
  const dragControls = useDragControls();

  const classes = [
    "road-item",
    "is-draggable",
    userTier === "free" ? "is-locked" : "",
    isNext ? "is-next" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Reorder.Item
      as="div"
      value={stop}
      id={stop.id}
      dragListener={false}
      dragControls={userTier === "pro" ? dragControls : undefined}
      className={classes}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className="marker" aria-hidden="true">
        {position}
      </span>
      <article className="stop-card stop-card--draggable">
        <div className="stop-card-main">
          {/* Manillar visual de arrastre condicionado por tier */}
          {userTier === "pro" ? (
            <div
              className="drag-handle"
              onPointerDown={(e) => dragControls.start(e)}
              title="Arrastrar para cambiar orden"
              style={{ touchAction: "none" }}
            >
              <DragHandleIcon size={14} />
            </div>
          ) : (
            <button
              className="drag-handle-locked"
              onClick={() => setSubscriptionModalOpen(true)}
              title="Suscríbete a Pro para arrastrar y personalizar el orden"
              type="button"
            >
              <LockIcon size={13} />
            </button>
          )}

          <div className="stop-card-content">
            <div className="stop-eyebrow">
              {isNext ? <strong>Siguiente</strong> : <span>Parada {position}</span>}
              {legKm !== undefined && (
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
                <CloseIcon width={14} height={14} />
              </button>
            </div>
            <div className="stop-actions">
              <a
                className="btn btn-nav"
                href={googleMapsNavUrl(stop)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Navegar
                <ArrowRightIcon width={15} height={15} />
              </a>
              <button
                className="btn btn-done"
                onClick={() => toggleDelivered(stop.id)}
              >
                Entregada
                <CheckIcon width={15} height={15} />
              </button>
            </div>
          </div>
        </div>
      </article>
    </Reorder.Item>
  );
}
