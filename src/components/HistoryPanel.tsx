import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaTrash, FaPen, FaClockRotateLeft } from "react-icons/fa6";
import { useHistoryStore } from "../state/historyStore";
import { useRouteStore } from "../state/routeStore";
import { defaultRouteLabel, formatElapsed, type RouteHistoryRecord } from "../lib/historyDb";
import { CloseIcon } from "./icons";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryPanel() {
  const [open, setOpen] = useState(false);
  const records = useHistoryStore((s) => s.records);
  const refresh = useHistoryStore((s) => s.refresh);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return (
    <>
      <button
        className="history-trigger"
        onClick={() => setOpen(true)}
        aria-label="Ver historial de rutas"
        title="Historial de rutas"
      >
        <FaClockRotateLeft size={18} />
      </button>
      {open && (
        <div
          className="history-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Historial de rutas"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="history-panel">
            <div className="history-panel__header">
              <h2>Historial de rutas</h2>
              <button
                className="history-close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar historial"
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>
            {records.length === 0 ? (
              <p className="history-empty">
                Todavía no hay rutas guardadas. Se registran solas en cuanto agregues la
                primera parada.
              </p>
            ) : (
              <ul className="history-list">
                {records.map((r) => (
                  <HistoryItem key={r.id} record={r} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function HistoryItem({ record }: { record: RouteHistoryRecord }) {
  const rename = useHistoryStore((s) => s.rename);
  const remove = useHistoryStore((s) => s.remove);
  const refresh = useHistoryStore((s) => s.refresh);
  const activeHistoryId = useRouteStore((s) => s.historyId);
  const setHistoryLabel = useRouteStore((s) => s.setHistoryLabel);
  const detachHistory = useRouteStore((s) => s.detachHistory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.label);
  const isActive = record.id === activeHistoryId;

  const saveLabel = async () => {
    setEditing(false);
    const label = draft.trim() || defaultRouteLabel(record.createdAt);
    if (label === record.label) return;
    if (isActive) {
      // El renombrado de la ruta activa pasa por routeStore (única fuente
      // de verdad mientras está en curso); la lista del panel lee de su
      // propia copia en historyStore, así que hay que refrescarla a mano
      // o el nombre nuevo no se vería hasta cerrar y reabrir el panel.
      await setHistoryLabel(label);
      await refresh();
    } else {
      await rename(record.id, label);
    }
  };

  const handleDelete = () => {
    toast(
      (t) => (
        <div className="confirm-modal" role="alertdialog" aria-label="Eliminar ruta">
          <p className="confirm-modal__text">
            ¿Eliminar &ldquo;{record.label}&rdquo; del historial? No se puede deshacer.
          </p>
          <div className="confirm-modal__actions">
            <button
              className="btn btn--danger"
              onClick={() => {
                toast.dismiss(t.id);
                // Si es la ruta que sigue en pantalla, hay que soltarla del
                // store ANTES de borrar el registro: si no, el próximo
                // cambio (una entrega marcada, etc.) la volvería a escribir.
                if (isActive) detachHistory(record.id);
                void remove(record.id);
              }}
            >
              Eliminar
            </button>
            <button className="btn btn--ghost" onClick={() => toast.dismiss(t.id)}>
              Cancelar
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, className: "confirm-toast" },
    );
  };

  return (
    <li className={`history-item${record.status === "completed" ? " is-completed" : ""}`}>
      <div className="history-item__top">
        {editing ? (
          <input
            className="history-item__input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveLabel()}
            onBlur={() => void saveLabel()}
            aria-label="Nombre de la ruta"
          />
        ) : (
          <span className="history-item__label">
            {isActive && <span className="history-live-dot" aria-hidden="true" />}
            {record.label}
          </span>
        )}
        <span className={`history-badge${record.status === "completed" ? " is-completed" : ""}`}>
          {record.status === "completed" ? "Completada" : "En curso"}
        </span>
      </div>
      <div className="history-item__meta">
        <span>Creada {formatDate(record.createdAt)}</span>
        <span>Modificada {formatDate(record.updatedAt)}</span>
      </div>
      <div className="history-item__stats">
        <span>
          {record.stopsDelivered}/{record.stopsTotal} entregadas
        </span>
        {record.distanceKm !== null && <span>{record.distanceKm.toFixed(1)} km</span>}
        {record.elapsedMs !== null && (
          <span>Duración: {formatElapsed(record.elapsedMs)}</span>
        )}
      </div>
      <div className="history-item__actions">
        <button
          className="history-icon-btn"
          onClick={() => setEditing(true)}
          aria-label={`Renombrar ${record.label}`}
        >
          <FaPen size={13} />
        </button>
        <button
          className="history-icon-btn history-icon-btn--danger"
          onClick={handleDelete}
          aria-label={`Eliminar ${record.label}`}
        >
          <FaTrash size={13} />
        </button>
      </div>
    </li>
  );
}
