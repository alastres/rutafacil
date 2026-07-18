import { useEffect } from "react";
import { toast, type Toast } from "react-hot-toast";
import { activeOverlays } from "../lib/overlays";

interface ConfirmToastProps {
  t: Toast;
  message: string | React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function ConfirmToast({
  t,
  message,
  onConfirm,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true,
}: ConfirmToastProps) {
  useEffect(() => {
    // Registrar el dismiss del toast como el método de cierre sin empujar al historial
    return activeOverlays.register(() => {
      toast.dismiss(t.id);
    }, false);
  }, [t.id]);

  return (
    <div className="confirm-modal" role="alertdialog">
      <div className="confirm-modal__text">{message}</div>
      <div className="confirm-modal__actions">
        <button
          className={`btn ${danger ? "btn--danger" : ""}`}
          onClick={() => {
            toast.dismiss(t.id);
            onConfirm();
          }}
        >
          {confirmText}
        </button>
        <button className="btn btn--ghost" onClick={() => toast.dismiss(t.id)}>
          {cancelText}
        </button>
      </div>
    </div>
  );
}
