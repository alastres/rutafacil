import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast, { type Toast } from "react-hot-toast";
import { activeOverlays } from "../lib/overlays";

export interface ConfirmOptions {
  message: string | React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmToastProps extends ConfirmOptions {
  t: Toast;
  onDismiss?: () => void;
}

let activeConfirmId: string | null = null;

export function showConfirm(options: ConfirmOptions): string {
  if (activeConfirmId) {
    toast.dismiss(activeConfirmId);
    activeConfirmId = null;
  }

  const id = toast(
    (t) => (
      <ConfirmToast
        t={t}
        {...options}
        onDismiss={() => {
          if (activeConfirmId === id) {
            activeConfirmId = null;
          }
        }}
      />
    ),
    {
      duration: Infinity,
      style: { display: "none" },
    }
  );

  activeConfirmId = id;
  return id;
}

export function ConfirmToast({
  t,
  message,
  onConfirm,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true,
  onDismiss,
}: ConfirmToastProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Registrar el dismiss del toast como el método de cierre sin empujar al historial
    return activeOverlays.register(() => {
      setDismissed(true);
      toast.dismiss(t.id);
      onDismiss?.();
    }, false);
  }, [t.id, onDismiss]);

  const handleDismiss = () => {
    setDismissed(true);
    toast.dismiss(t.id);
    onDismiss?.();
  };

  if (dismissed || !t.visible) {
    return null;
  }

  return createPortal(
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={handleDismiss}
    >
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-modal__text">{message}</div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className={`btn ${danger ? "btn--danger" : ""}`}
            onClick={() => {
              handleDismiss();
              onConfirm();
            }}
          >
            {confirmText}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleDismiss}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


