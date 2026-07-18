import { useState } from "react";
import { parseSharedText } from "../lib/parse";
import { resolveShortLink } from "../lib/resolve";
import type { LatLng } from "../lib/geo";
import { MapPointPicker } from "./MapPointPicker";
import { PasteIcon, MapIcon, CheckIcon, CloseIcon } from "./icons";

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

  const handleLocationText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onNotify("Ingresa un enlace de Maps o coordenadas.", true);
      return;
    }
    setBusy(true);
    try {
      let result = parseSharedText(trimmed);
      if (result.kind === "short-link") {
        const finalUrl = await resolveShortLink(result.url);
        result = finalUrl ? parseSharedText(finalUrl) : { kind: "none" };
      }
      if (result.kind === "ok") {
        setPicked({ lat: result.lat, lng: result.lng });
        if (!label && result.label) setLabel(result.label);
        onNotify("Ubicación encontrada");
        setPasteText("");
      } else {
        onNotify("No encontré ninguna ubicación válida.", true);
      }
    } finally {
      setBusy(false);
    }
  };

  const pasteFromClipboard = async () => {
    setBusy(true);
    try {
      const text = await navigator.clipboard.readText();
      await handleLocationText(text);
    } catch {
      onNotify("No pude leer el portapapeles. Pega manualmente.", true);
    } finally {
      setBusy(false);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPasteText(val);
    
    // Autodetect complete paste
    const trimmed = val.trim();
    if (trimmed.length > 8) {
      let result = parseSharedText(trimmed);
      if (result.kind === "short-link") {
        setBusy(true);
        const finalUrl = await resolveShortLink(result.url);
        result = finalUrl ? parseSharedText(finalUrl) : { kind: "none" };
        setBusy(false);
      }
      if (result.kind === "ok") {
        setPicked({ lat: result.lat, lng: result.lng });
        if (!label && result.label) setLabel(result.label);
        onNotify("Ubicación encontrada");
        setPasteText("");
      }
    }
  };

  const confirmSave = () => {
    if (!picked) {
      onNotify("Define la ubicación primero (pega enlace o usa el mapa).", true);
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
          placeholder="Ej. Bodega, Casa, Depósito"
          aria-label="Nombre del punto de retorno"
        />
      </label>

      <div className="return-point-form__field">
        <span>Ubicación</span>
        {picked ? (
          <div className="location-success-badge">
            <CheckIcon size={16} color="var(--senal-verde)" />
            <div className="location-success-badge__content">
              <span className="location-success-badge__title">Fijada: </span>
              <span className="location-success-badge__coords">
                {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
              </span>
            </div>
            <button
              type="button"
              className="location-success-badge__clear"
              onClick={() => setPicked(null)}
              aria-label="Cambiar ubicación"
              title="Cambiar ubicación"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ) : (
          <div className="location-input-group">
            <input
              value={pasteText}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && void handleLocationText(pasteText)}
              placeholder="Pegar enlace o coordenadas"
              aria-label="Pegar enlace de Maps o coordenadas"
              disabled={busy}
            />
            <button
              type="button"
              className="btn-paste-location"
              onClick={() => void pasteFromClipboard()}
              disabled={busy}
              title="Pegar desde portapapeles"
            >
              <PasteIcon size={16} />
            </button>
            <button
              type="button"
              className="btn-map-location"
              onClick={() => setShowMapPicker(true)}
              disabled={busy}
              title="Tocar en el mapa"
            >
              <MapIcon size={16} />
              <span>Mapa</span>
            </button>
          </div>
        )}
      </div>

      <div className="return-point-form__actions">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn btn-nav" onClick={confirmSave}>
          Guardar
        </button>
      </div>
    </div>
  );
}
