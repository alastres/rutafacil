import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { activeOverlays } from "../lib/overlays";
import { toast } from "react-hot-toast";
import { ConfirmToast } from "./ConfirmToast";
import { useReturnPointsStore } from "../state/returnPointsStore";
import { useRouteStore } from "../state/routeStore";
import type { SavedReturnPoint } from "../lib/historyDb";
import { CloseIcon, PinIcon, PlusIcon, CheckIcon, TrashIcon } from "./icons";
import { ReturnPointForm } from "./ReturnPointForm";

let counter = 0;
const newId = () => `retpt-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function ReturnPointTrigger({
  onNotify,
}: {
  onNotify: (text: string, error?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const returnPoint = useRouteStore((s) => s.returnPoint);

  return (
    <>
      <button
        className="return-point-trigger"
        onClick={() => setOpen(true)}
        aria-label={
          returnPoint ? `Punto de retorno: ${returnPoint.label}` : "Añadir punto de retorno"
        }
      >
        <PinIcon size={13} />
        {returnPoint ? returnPoint.label : "Punto de retorno"}
      </button>
      {open && <ReturnPointSheet onClose={() => setOpen(false)} onNotify={onNotify} />}
    </>
  );
}

function ReturnPointSheet({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify: (text: string, error?: boolean) => void;
}) {
  const points = useReturnPointsStore((s) => s.points);
  const refresh = useReturnPointsStore((s) => s.refresh);
  const save = useReturnPointsStore((s) => s.save);
  const remove = useReturnPointsStore((s) => s.remove);
  const returnPoint = useRouteStore((s) => s.returnPoint);
  const setReturnPoint = useRouteStore((s) => s.setReturnPoint);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void refresh().then(() => setLoaded(true));
  }, [refresh]);

  useEffect(() => {
    if (loaded && !creating && points.length === 0) setCreating(true);
  }, [loaded, creating, points.length]);

  useEffect(() => {
    return activeOverlays.register(onClose);
  }, [onClose]);

  const handleUse = (point: SavedReturnPoint) => {
    setReturnPoint({ id: point.id, label: point.label, lat: point.lat, lng: point.lng });
    onNotify(`Punto de retorno: ${point.label}`);
    onClose();
  };

  const handleDelete = (point: SavedReturnPoint) => {
    toast(
      (t) => (
        <ConfirmToast
          t={t}
          message={`¿Eliminar “${point.label}”? No se puede deshacer.`}
          confirmText="Eliminar"
          onConfirm={() => {
            void remove(point.id);
            if (returnPoint?.id === point.id) setReturnPoint(null);
          }}
        />
      ),
      { duration: Infinity, className: "confirm-toast" },
    );
  };

  const handleSave = async (input: { label: string; lat: number; lng: number }) => {
    const now = Date.now();
    const point: SavedReturnPoint = { id: newId(), ...input, createdAt: now, updatedAt: now };
    await save(point);
    setReturnPoint({ id: point.id, label: point.label, lat: point.lat, lng: point.lng });
    onNotify(`Punto de retorno "${point.label}" guardado`);
    onClose();
  };

  return createPortal(
    <div
      className="history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Punto de retorno"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="history-panel">
        <div className="history-panel__header">
          <h2>Punto de retorno</h2>
          <button className="history-close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {creating ? (
          <ReturnPointForm
            onSave={(input) => void handleSave(input)}
            onCancel={() => (points.length === 0 ? onClose() : setCreating(false))}
            onNotify={onNotify}
          />
        ) : (
          <>
            <ul className="return-point-list">
              {points.map((point) => {
                const isActive = returnPoint?.id === point.id;
                return (
                  <li
                    key={point.id}
                    className={`return-point-list__item${
                      isActive ? " return-point-list__item--active" : ""
                    }`}
                  >
                    <button className="return-point-list__use" onClick={() => handleUse(point)}>
                      <span className="return-point-list__content">
                        <span className="return-point-list__pin-icon">
                          <PinIcon size={14} />
                        </span>
                        {point.label}
                        {isActive && (
                          <span className="return-point-list__active-icon">
                            <CheckIcon size={14} />
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      className="history-icon-btn history-icon-btn--danger"
                      onClick={() => handleDelete(point)}
                      aria-label={`Eliminar ${point.label}`}
                    >
                      <CloseIcon width={13} height={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {returnPoint && (
              <button
                className="return-point-remove"
                onClick={() => {
                  setReturnPoint(null);
                  onNotify("Punto de retorno quitado de esta ruta");
                  onClose();
                }}
              >
                <TrashIcon size={14} />
                Quitar de esta ruta
              </button>
            )}
            <button className="return-point-new" onClick={() => setCreating(true)}>
              <PlusIcon width={14} height={14} />
              Nuevo punto
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
