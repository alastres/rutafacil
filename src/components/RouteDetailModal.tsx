import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { activeOverlays } from "../lib/overlays";
import { CloseIcon, CheckIcon } from "./icons";
import { MODES } from "./ModeSelector";
import { formatElapsed, type RouteHistoryRecord } from "../lib/historyDb";
import { generateSingleRouteReport, shareText } from "../lib/share";
import { FaShareNodes } from "react-icons/fa6";
import RouteDetailMap from "./RouteDetailMap";
import { AdBanner } from "./AdBanner";

function formatDateFull(ts?: number | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function RouteDetailModal({
  record,
  onClose,
}: {
  record: RouteHistoryRecord;
  onClose: () => void;
}) {
  const stops = record?.stops ?? [];
  const modeMeta = MODES.find((m) => m.value === record?.mode);

  const mountTimeRef = useRef(Date.now());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    mountTimeRef.current = Date.now();
    return activeOverlays.register(() => onCloseRef.current());
  }, []);

  if (!record) return null;

  const hasDistance = typeof record.distanceKm === "number" && !isNaN(record.distanceKm);
  const hasElapsed = typeof record.elapsedMs === "number" && !isNaN(record.elapsedMs);

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Ignorar clics en el fondo durante los primeros 350ms tras montarse
    if (Date.now() - mountTimeRef.current < 350) return;
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="history-overlay history-overlay--detail"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${record.label || "Ruta"}`}
      onClick={handleBackdropClick}
    >
      <div className="history-panel history-detail">
        <div className="history-panel__header">
          <h2>{record.label || "Detalle de Ruta"}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="history-close"
              onClick={async () => {
                const report = generateSingleRouteReport(record);
                await shareText(record.label || "Rendición de Ruta", report);
              }}
              aria-label="Compartir Rendición por WhatsApp"
              title="Compartir Rendición por WhatsApp"
            >
              <FaShareNodes size={15} />
            </button>
            <button className="history-close" onClick={onClose} aria-label="Cerrar detalle">
              <CloseIcon width={16} height={16} />
            </button>
          </div>
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
              <dd>{hasElapsed ? formatElapsed(record.elapsedMs!) : "—"}</dd>
            </div>
            <div>
              <dt>Distancia</dt>
              <dd>{hasDistance ? `${record.distanceKm!.toFixed(1)} km` : "—"}</dd>
            </div>
            <div>
              <dt>Vehículo</dt>
              <dd className="history-detail__mode">
                {modeMeta && <modeMeta.Icon width={14} height={14} />}
                {modeMeta?.label ?? record.mode ?? "Auto"}
              </dd>
            </div>
            <div>
              <dt>Paradas</dt>
              <dd>
                {record.stopsDelivered ?? 0}/{record.stopsTotal ?? 0} entregadas
              </dd>
            </div>
            <div>
              <dt>Punto de retorno</dt>
              <dd>{record.returnPoint?.label ?? "—"}</dd>
            </div>
          </dl>

          {stops.length > 0 ? (
            <>
              <RouteDetailMap
                stops={stops}
                geometry={record.geometry}
                origin={record.origin}
                returnPoint={record.returnPoint}
              />

              <ol className="history-detail__stops">
                {stops.map((s, i) => (
                  <li key={s.id || i} className={s.delivered ? "is-delivered" : ""}>
                    <span className="history-detail__stop-n">
                      {s.delivered ? <CheckIcon width={12} height={12} /> : i + 1}
                    </span>
                    <span className="history-detail__stop-label">{s.label || `Parada ${i + 1}`}</span>
                    {typeof s.legKm === "number" && !isNaN(s.legKm) && (
                      <span className="history-detail__stop-km">+{s.legKm.toFixed(1)} km</span>
                    )}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="history-empty">
              Esta ruta no tiene paradas registradas en el historial.
            </p>
          )}
          <AdBanner slotId="route-detail-bottom" format="rectangle" />
        </div>
      </div>
    </div>,
    document.body
  );
}
