import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { activeOverlays } from "../lib/overlays";
import { CloseIcon, PlusIcon, PinIcon, CheckIcon, MapIcon } from "./icons";
import { parseSharedText } from "../lib/parse";
import { generateWhatsAppDispatchText, shareText, formatCurrency } from "../lib/share";
import { useRouteStore } from "../state/routeStore";
import { showToast } from "../lib/toast";
import { MapPointPicker } from "./MapPointPicker";
import type { LatLng } from "../lib/geo";
import { FaWhatsapp, FaDollarSign, FaGasPump, FaUser, FaClipboardList, FaTruckFast } from "react-icons/fa6";

export function DispatchModal({ onClose }: { onClose: () => void }) {
  const [addressInput, setAddressInput] = useState("");
  const [picked, setPicked] = useState<LatLng | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [assignee, setAssignee] = useState("");
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [travelAllowance, setTravelAllowance] = useState<string>("");
  const [notes, setNotes] = useState("");

  const addEnrichedStop = useRouteStore((s) => s.addEnrichedStop);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();
    return activeOverlays.register(() => onCloseRef.current());
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (Date.now() - mountTimeRef.current < 350) return;
    if (e.target === e.currentTarget) onClose();
  };

  const parseInput = () => {
    if (picked) {
      return {
        lat: picked.lat,
        lng: picked.lng,
        label: addressInput.trim() || `Ubicación (${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)})`,
      };
    }
    const raw = addressInput.trim();
    if (!raw) return null;
    const parsed = parseSharedText(raw);
    if (parsed.kind === "ok") {
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        label: parsed.label || raw.slice(0, 40),
      };
    }
    return {
      lat: 4.6097,
      lng: -74.0817,
      label: raw,
    };
  };

  const getNumericValues = () => {
    const c = parseFloat(collectAmount.replace(/[^0-9.]/g, ""));
    const v = parseFloat(travelAllowance.replace(/[^0-9.]/g, ""));
    return {
      collectAmount: !isNaN(c) && c > 0 ? c : undefined,
      travelAllowance: !isNaN(v) && v > 0 ? v : undefined,
    };
  };

  const handleSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInput();
    if (!parsed) {
      showToast("Ingresa la dirección o selecciona el punto en el mapa");
      return;
    }

    const { collectAmount: c, travelAllowance: v } = getNumericValues();
    const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://rutafacil.app";
    
    const smartUrl = new URL(appOrigin);
    smartUrl.searchParams.set("geo", `${parsed.lat},${parsed.lng}`);
    smartUrl.searchParams.set("label", parsed.label);
    if (c) smartUrl.searchParams.set("cobro", c.toString());
    if (v) smartUrl.searchParams.set("viaticos", v.toString());
    if (notes.trim()) smartUrl.searchParams.set("notes", notes.trim());
    if (assignee.trim()) smartUrl.searchParams.set("repartidor", assignee.trim());

    const message = generateWhatsAppDispatchText({
      geoUrl: smartUrl.toString(),
      label: parsed.label,
      collectAmount: c,
      travelAllowance: v,
      notes: notes.trim() || undefined,
      assignee: assignee.trim() || undefined,
    });

    await shareText("NUEVO PEDIDO ASIGNADO", message);
    onClose();
  };

  const handleAddToLocalRoute = (e: React.MouseEvent) => {
    e.preventDefault();
    const parsed = parseInput();
    if (!parsed) {
      showToast("Ingresa la dirección o selecciona el punto en el mapa");
      return;
    }

    const { collectAmount: c, travelAllowance: v } = getNumericValues();
    addEnrichedStop({
      lat: parsed.lat,
      lng: parsed.lng,
      label: parsed.label,
      collectAmount: c,
      travelAllowance: v,
      notes: notes.trim() || undefined,
      assignee: assignee.trim() || undefined,
    });

    showToast(`Pedido añadido: ${parsed.label} (${c ? formatCurrency(c) : "Sin cobro"})`);
    onClose();
  };

  if (showMapPicker) {
    return (
      <MapPointPicker
        initial={picked ?? undefined}
        onConfirm={(point) => {
          setPicked(point);
          setShowMapPicker(false);
          showToast("Ubicación seleccionada en mapa");
        }}
        onCancel={() => setShowMapPicker(false)}
      />
    );
  }

  return createPortal(
    <div
      className="history-overlay history-overlay--detail"
      role="dialog"
      aria-modal="true"
      aria-label="Despachar Pedido por WhatsApp"
      onClick={handleBackdropClick}
    >
      <div className="history-panel dispatch-modal">
        <div className="history-panel__header">
          <h2 className="dispatch-title">
            <FaTruckFast size={18} /> Despachar Pedido
          </h2>
          <button className="history-close" onClick={onClose} aria-label="Cerrar modal">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <form className="dispatch-modal__form" onSubmit={handleSendWhatsApp}>
          <div className="dispatch-field">
            <label className="dispatch-label">
              <PinIcon size={14} /> Dirección o Ubicación en Mapa
            </label>
            {picked ? (
              <div className="location-success-badge">
                <CheckIcon size={16} color="var(--senal-verde)" />
                <div className="location-success-badge__content">
                  <span className="location-success-badge__title">Fijada en mapa: </span>
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
                  type="text"
                  className="dispatch-input"
                  placeholder="Calle 10 #5-20 o pega enlace de Maps..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-map-location"
                  onClick={() => setShowMapPicker(true)}
                  title="Elegir punto en el mapa"
                >
                  <MapIcon size={16} />
                  <span>Mapa</span>
                </button>
              </div>
            )}
          </div>

          <div className="dispatch-field-row">
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="dp-cobro">
                <FaDollarSign size={13} /> Cobro al Cliente ($)
              </label>
              <input
                id="dp-cobro"
                type="number"
                className="dispatch-input"
                placeholder="50000"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
              />
            </div>

            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="dp-viaticos">
                <FaGasPump size={13} /> Viáticos ($)
              </label>
              <input
                id="dp-viaticos"
                type="number"
                className="dispatch-input"
                placeholder="5000"
                value={travelAllowance}
                onChange={(e) => setTravelAllowance(e.target.value)}
              />
            </div>
          </div>

          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dp-assignee">
              <FaUser size={13} /> Repartidor Asignado (opcional)
            </label>
            <input
              id="dp-assignee"
              type="text"
              className="dispatch-input"
              placeholder="Ej: Carlos"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>

          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dp-notes">
              <FaClipboardList size={13} /> Indicaciones / Notas
            </label>
            <input
              id="dp-notes"
              type="text"
              className="dispatch-input"
              placeholder="Ej: Apto 302, llevar cambio de $50k"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="dispatch-modal__actions">
            <button type="submit" className="dispatch-btn dispatch-btn--wa">
              <FaWhatsapp size={18} /> Asignar por WhatsApp
            </button>
            <button type="button" className="dispatch-btn dispatch-btn--secondary" onClick={handleAddToLocalRoute}>
              <PlusIcon width={16} height={16} /> Cargar en mi ruta
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
