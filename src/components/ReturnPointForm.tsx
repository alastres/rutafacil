import { useState } from "react";
import { parseSharedText } from "../lib/parse";
import { resolveShortLink } from "../lib/resolve";
import type { LatLng } from "../lib/geo";
import { MapPointPicker } from "./MapPointPicker";

export function ReturnPointForm({
  onSave,
  onCancel,
  onNotify,
}: {
  onSave: (input: { label: string; lat: number; lng: number }) => void;
  onCancel: () => void;
  onNotify: (text: string, error?: boolean) => void;
}) {
  const [label, setLabel] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [picked, setPicked] = useState<LatLng | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolveFromPaste = async () => {
    setBusy(true);
    try {
      const text = pasteText.trim();
      if (!text) {
        onNotify("Pega un enlace de Maps o coordenadas.", true);
        return;
      }
      let result = parseSharedText(text);
      if (result.kind === "short-link") {
        const finalUrl = await resolveShortLink(result.url);
        result = finalUrl ? parseSharedText(finalUrl) : { kind: "none" };
      }
      if (result.kind !== "ok") {
        onNotify("No encontré ninguna ubicación en ese texto.", true);
        return;
      }
      setPicked({ lat: result.lat, lng: result.lng });
      if (!label && result.label) setLabel(result.label);
      onNotify("Ubicación encontrada");
    } finally {
      setBusy(false);
    }
  };

  const confirmSave = () => {
    if (!picked) {
      onNotify("Primero define la ubicación: pega un enlace o toca el mapa.", true);
      return;
    }
    const finalLabel = label.trim() || "Punto de retorno";
    onSave({ label: finalLabel, lat: picked.lat, lng: picked.lng });
  };

  if (showMapPicker) {
    return (
      <MapPointPicker
        initial={picked ?? undefined}
        onConfirm={(point) => {
          setPicked(point);
          setShowMapPicker(false);
        }}
        onCancel={() => setShowMapPicker(false)}
      />
    );
  }

  return (
    <div className="return-point-form">
      <label className="return-point-form__field">
        Nombre
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej. Bodega"
          aria-label="Nombre del punto de retorno"
        />
      </label>

      <div className="return-point-form__field">
        <span>Ubicación</span>
        <p
          className={`return-point-form__picked${picked ? "" : " return-point-form__picked--empty"}`}
        >
          {picked ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : "Sin definir todavía"}
        </p>
        <textarea
          rows={1}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Pega un enlace de Maps o coordenadas"
          aria-label="Pega un enlace de Maps o coordenadas para el punto de retorno"
          disabled={busy}
        />
        <div className="return-point-form__actions-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void resolveFromPaste()}
            disabled={busy}
          >
            Usar enlace pegado
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowMapPicker(true)}>
            Tocar en el mapa
          </button>
        </div>
      </div>

      <div className="return-point-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn btn-nav" onClick={confirmSave}>
          Guardar
        </button>
      </div>
    </div>
  );
}
