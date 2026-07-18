import { lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, CheckIcon } from "./icons";
import { MODES } from "./ModeSelector";
import { formatElapsed, type RouteHistoryRecord } from "../lib/historyDb";

const RouteDetailMap = lazy(() => import("./RouteDetailMap"));

function formatDateFull(ts: number): string {
  return new Date(ts).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RouteDetailModal({
  record,
  onClose,
}: {
  record: RouteHistoryRecord;
  onClose: () => void;
}) {
  const stops = record.stops ?? [];
  const modeMeta = MODES.find((m) => m.value === record.mode);

  return createPortal(
    <div
      className="history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${record.label}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="history-panel history-detail">
        <div className="history-panel__header">
          <h2>{record.label}</h2>
          <button className="history-close" onClick={onClose} aria-label="Cerrar detalle">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="history-detail__body">
          <span
            className={`history-badge${record.status === "completed" ? " is-completed" : ""}`}
          >
            {record.status === "completed" ? "Completada" : "En curso"}
          </span>

          <dl className="history-detail__grid">
            <div>
              <dt>Creada</dt>
              <dd>{formatDateFull(record.createdAt)}</dd>
            </div>
            <div>
              <dt>Modificada</dt>
              <dd>{formatDateFull(record.updatedAt)}</dd>
            </div>
            <div>
              <dt>Seguimiento iniciado</dt>
              <dd>{record.trackingStartedAt ? formatDateFull(record.trackingStartedAt) : "No se activó"}</dd>
            </div>
            <div>
              <dt>Última entrega</dt>
              <dd>{record.completedAt ? formatDateFull(record.completedAt) : "Pendiente"}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{record.elapsedMs !== null ? formatElapsed(record.elapsedMs) : "—"}</dd>
            </div>
            <div>
              <dt>Distancia</dt>
              <dd>{record.distanceKm !== null ? `${record.distanceKm.toFixed(1)} km` : "—"}</dd>
            </div>
            <div>
              <dt>Vehículo</dt>
              <dd className="history-detail__mode">
                {modeMeta && <modeMeta.Icon width={14} height={14} />}
                {modeMeta?.label ?? record.mode}
              </dd>
            </div>
            <div>
              <dt>Paradas</dt>
              <dd>
                {record.stopsDelivered}/{record.stopsTotal} entregadas
              </dd>
            </div>
            <div>
              <dt>Punto de retorno</dt>
              <dd>{record.returnPoint?.label ?? "—"}</dd>
            </div>
          </dl>

          {stops.length > 0 ? (
            <>
              <Suspense fallback={<div className="map-wrap" />}>
                <RouteDetailMap
                  stops={stops}
                  geometry={record.geometry}
                  origin={record.origin}
                  returnPoint={record.returnPoint}
                />
              </Suspense>

              <ol className="history-detail__stops">
                {stops.map((s, i) => (
                  <li key={s.id} className={s.delivered ? "is-delivered" : ""}>
                    <span className="history-detail__stop-n">
                      {s.delivered ? <CheckIcon width={12} height={12} /> : i + 1}
                    </span>
                    <span className="history-detail__stop-label">{s.label}</span>
                    {s.legKm !== undefined && (
                      <span className="history-detail__stop-km">+{s.legKm.toFixed(1)} km</span>
                    )}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="history-empty">
              Esta ruta se guardó antes de que el detalle registrara las paradas, así que no
              hay recorrido que mostrar.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
