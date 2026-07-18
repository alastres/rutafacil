import { createPortal } from "react-dom";
import { RoadList } from "./RoadList";
import { AddStop } from "./AddStop";
import { CloseIcon, ListIcon } from "./icons";

export function StopsOffcanvas({
  open,
  moving,
  onClose,
  onAddStop,
  onNotify,
}: {
  open: boolean;
  moving: boolean;
  onClose: () => void;
  onAddStop: (text: string) => Promise<boolean>;
  onNotify: (text: string, error?: boolean) => void;
}) {
  return createPortal(
    <div
      className={`stops-offcanvas${open ? " is-open" : ""}`}
      aria-hidden={!open}
    >
      {/* overlay semitransparente — clic cierra el panel */}
      <div
        className="stops-offcanvas__overlay"
        onClick={onClose}
        aria-label="Cerrar lista de paradas"
      />

      {/* panel deslizante */}
      <div
        className="stops-offcanvas__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Lista de paradas"
      >
        <div className="stops-offcanvas__header">
          <span className="stops-offcanvas__title">
            <ListIcon size={16} />
            Lista de paradas
          </span>
          <button
            className="stops-offcanvas__close"
            onClick={onClose}
            aria-label="Cerrar lista"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="stops-offcanvas__add">
          <AddStop onSubmit={onAddStop} onNotify={onNotify} />
        </div>

        <div className="stops-offcanvas__body">
          <RoadList moving={moving} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
