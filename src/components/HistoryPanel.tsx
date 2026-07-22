import { createPortal } from "react-dom";
import { useEffect, useState, useRef } from "react";
import { activeOverlays } from "../lib/overlays";
import { FaTrash, FaPen, FaClockRotateLeft, FaEye, FaShareNodes, FaListCheck } from "react-icons/fa6";
import { useHistoryStore } from "../state/historyStore";
import { useRouteStore } from "../state/routeStore";
import {
  defaultRouteLabel,
  formatElapsed,
  isStoragePersisted,
  type RouteHistoryRecord,
} from "../lib/historyDb";
import { generateSingleRouteReport, generateBatchRouteReport, shareText } from "../lib/share";
import { CloseIcon } from "./icons";
import { RouteDetailModal } from "./RouteDetailModal";
import { showConfirm } from "./ConfirmToast";
import { showSuccessToast } from "../lib/toast";

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
  const [detailRecord, setDetailRecord] = useState<RouteHistoryRecord | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const records = useHistoryStore((s) => s.records);
  const refresh = useHistoryStore((s) => s.refresh);
  const removeMany = useHistoryStore((s) => s.removeMany);
  const activeHistoryId = useRouteStore((s) => s.historyId);
  const detachHistory = useRouteStore((s) => s.detachHistory);

  const panelMountTimeRef = useRef(Date.now());

  useEffect(() => {
    if (open) {
      panelMountTimeRef.current = Date.now();
      void refresh();
      void isStoragePersisted().then(setPersisted);
    } else {
      setSelectMode(false);
      setSelected(new Set());
    }
  }, [open, refresh]);

  useEffect(() => {
    if (open) {
      return activeOverlays.register(() => setOpen(false));
    }
  }, [open]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = records.length > 0 && selected.size === records.length;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(records.map((r) => r.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleDeleteSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const count = ids.length;
    showConfirm({
      message: `¿Eliminar ${count} ruta${count > 1 ? "s" : ""} del historial? No se puede deshacer.`,
      confirmText: "Eliminar",
      onConfirm: async () => {
        if (activeHistoryId && ids.includes(activeHistoryId)) {
          detachHistory(activeHistoryId);
        }
        await removeMany(ids);
        exitSelectMode();
        showSuccessToast(`${count} ruta${count > 1 ? "s eliminadas" : " eliminada"} del historial`);
      },
    });
  };

  const handleShareSelected = async () => {
    const selectedRecords = records.filter((r) => selected.has(r.id));
    if (selectedRecords.length === 0) return;
    const report = generateBatchRouteReport(selectedRecords);
    await shareText(`Consolidado ${selectedRecords.length} Rutas`, report);
  };

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
      {open && createPortal(
        <div
          className="history-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Historial de rutas"
          onClick={(e) => {
            if (Date.now() - panelMountTimeRef.current < 350) return;
            if (e.target === e.currentTarget) setOpen(false);
          }}
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

            {records.length > 0 && (
              <div className="history-panel__toolbar">
                {selectMode ? (
                  <>
                    <button className="history-link-btn" onClick={toggleSelectAll}>
                      {allSelected ? "Ninguna" : "Todas"}
                    </button>
                    <span className="history-toolbar__count">
                      {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
                    </span>
                    <button className="history-link-btn" onClick={exitSelectMode}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button className="history-link-btn" onClick={() => setSelectMode(true)}>
                    <FaListCheck size={13} /> Selección por lotes
                  </button>
                )}
              </div>
            )}

            {records.length === 0 ? (
              <p className="history-empty">
                Todavía no hay rutas guardadas. Se registran solas en cuanto agregues la
                primera parada.
              </p>
            ) : (
              <ul className="history-list">
                {records.map((r) => (
                  <HistoryItem
                    key={r.id}
                    record={r}
                    onViewDetail={() => setDetailRecord(r)}
                    selectMode={selectMode}
                    selected={selected.has(r.id)}
                    onToggleSelect={() => toggleSelected(r.id)}
                  />
                ))}
              </ul>
            )}

            {selectMode && selected.size > 0 && (
              <div className="history-panel__footer">
                <button className="btn btn--primary" onClick={handleShareSelected} style={{ flex: 1 }}>
                  <FaShareNodes size={13} /> Compartir ({selected.size})
                </button>
                <button className="btn btn--danger" onClick={handleDeleteSelected}>
                  <FaTrash size={13} /> Eliminar ({selected.size})
                </button>
              </div>
            )}

            {persisted !== null && (
              <p className="history-storage-note">
                {persisted
                  ? "Almacenamiento persistente activado: el navegador no debería borrar este historial por falta de espacio."
                  : "Almacenamiento no marcado como persistente todavía (algunos navegadores lo conceden solo con la app instalada o de más uso)."}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
      {detailRecord && (
        <RouteDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      )}
    </>
  );
}

function HistoryItem({
  record,
  onViewDetail,
  selectMode,
  selected,
  onToggleSelect,
}: {
  record: RouteHistoryRecord;
  onViewDetail: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
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
    showConfirm({
      message: `¿Eliminar “${record.label}” del historial? No se puede deshacer.`,
      confirmText: "Eliminar",
      onConfirm: async () => {
        if (isActive) detachHistory(record.id);
        await remove(record.id);
        showSuccessToast(`Ruta “${record.label}” eliminada del historial`);
      },
    });
  };

  return (
    <li
      className={`history-item${record.status === "completed" ? " is-completed" : ""}${selectMode ? " is-selectable" : ""}${selected ? " is-selected" : ""}`}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      <div className="history-item__top">
        {selectMode && (
          <input
            type="checkbox"
            className="history-item__checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Seleccionar ${record.label}`}
          />
        )}
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
          {record.stopsDelivered ?? 0}/{record.stopsTotal ?? 0} entregadas
        </span>
        {typeof record.distanceKm === "number" && !isNaN(record.distanceKm) && (
          <span>{record.distanceKm.toFixed(1)} km</span>
        )}
        {typeof record.elapsedMs === "number" && !isNaN(record.elapsedMs) && (
          <span>Duración: {formatElapsed(record.elapsedMs)}</span>
        )}
      </div>
      {!selectMode && (
        <div className="history-item__actions">
          <button
            className="history-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail();
            }}
            aria-label={`Ver detalle de ${record.label}`}
          >
            <FaEye size={13} />
          </button>
          <button
            className="history-icon-btn"
            onClick={async (e) => {
              e.stopPropagation();
              const report = generateSingleRouteReport(record);
              await shareText(record.label || "Rendición de Ruta", report);
            }}
            aria-label={`Compartir ${record.label}`}
            title="Compartir por WhatsApp"
          >
            <FaShareNodes size={13} />
          </button>
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
      )}
    </li>
  );
}
