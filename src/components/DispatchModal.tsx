import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { activeOverlays } from "../lib/overlays";
import { CloseIcon, PlusIcon, PinIcon, CheckIcon, MapIcon, AlertIcon } from "./icons";
import { parseSharedText } from "../lib/parse";
import { generateWhatsAppDispatchText, shareText, formatCurrency } from "../lib/share";
import { useRouteStore } from "../state/routeStore";
import { showToast } from "../lib/toast";
import { MapPointPicker } from "./MapPointPicker";
import type { LatLng } from "../lib/geo";
import {
  FaWhatsapp,
  FaDollarSign,
  FaGasPump,
  FaUser,
  FaClipboardList,
  FaTruckFast,
  FaBuilding,
} from "react-icons/fa6";

export function DispatchModal({ onClose }: { onClose: () => void }) {
  const [orderKind, setOrderKind] = useState<"delivery" | "pickup">("delivery");

  const [addressInput, setAddressInput] = useState("");
  const [picked, setPicked] = useState<LatLng | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [addressError, setAddressError] = useState(false);

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

  const validateAndParseInput = () => {
    const isPickup = orderKind === "pickup";
    const prefix = isPickup ? "[Recogida] " : "";

    if (picked) {
      setAddressError(false);
      const rawLabel = addressInput.trim() || `Ubicación (${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)})`;
      const fullLabel = rawLabel.startsWith("[Recogida]") ? rawLabel : `${prefix}${rawLabel}`;
      return {
        lat: picked.lat,
        lng: picked.lng,
        label: fullLabel,
      };
    }

    const raw = addressInput.trim();
    if (!raw) {
      setAddressError(true);
      return null;
    }

    setAddressError(false);
    const parsed = parseSharedText(raw);
    if (parsed.kind === "ok") {
      const baseLabel = parsed.label || raw.slice(0, 40);
      const fullLabel = baseLabel.startsWith("[Recogida]") ? baseLabel : `${prefix}${baseLabel}`;
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        label: fullLabel,
      };
    }

    const fullLabel = raw.startsWith("[Recogida]") ? raw : `${prefix}${raw}`;
    return {
      lat: 4.6097,
      lng: -74.0817,
      label: fullLabel,
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
    const parsed = validateAndParseInput();
    if (!parsed) {
      showToast(
        orderKind === "delivery"
          ? "Por favor ingresa la dirección de entrega o punto en el mapa"
          : "Por favor ingresa la dirección de recogida o punto en el mapa"
      );
      return;
    }

    const { collectAmount: c, travelAllowance: v } = getNumericValues();
    const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://rutafacil.app";
    
    const smartUrl = new URL(appOrigin);
    smartUrl.searchParams.set("geo", `${parsed.lat},${parsed.lng}`);
    smartUrl.searchParams.set("label", parsed.label);
    smartUrl.searchParams.set("kind", orderKind);
    if (c) smartUrl.searchParams.set("cobro", c.toString());
    if (v) smartUrl.searchParams.set("viaticos", v.toString());
    if (notes.trim()) smartUrl.searchParams.set("notes", notes.trim());
    if (assignee.trim()) smartUrl.searchParams.set("repartidor", assignee.trim());

    const message = generateWhatsAppDispatchText({
      geoUrl: smartUrl.toString(),
      label: parsed.label,
      kind: orderKind,
      collectAmount: c,
      travelAllowance: v,
      notes: notes.trim() || undefined,
      assignee: assignee.trim() || undefined,
    });

    const shareTitle = orderKind === "pickup" ? "RECOGIDA ASIGNADA" : "ENTREGA ASIGNADA";
    await shareText(shareTitle, message);
    onClose();
  };

  const handleAddToLocalRoute = (e: React.MouseEvent) => {
    e.preventDefault();
    const parsed = validateAndParseInput();
    if (!parsed) {
      showToast(
        orderKind === "delivery"
          ? "Por favor ingresa la dirección de entrega o punto en el mapa"
          : "Por favor ingresa la dirección de recogida o punto en el mapa"
      );
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

    const typeMsg = orderKind === "pickup" ? "Recogida añadida" : "Entrega añadida";
    showToast(`${typeMsg}: ${parsed.label} (${c ? formatCurrency(c) : "Sin cobro/pago"})`);
    onClose();
  };

  if (showMapPicker) {
    return (
      <MapPointPicker
        initial={picked ?? undefined}
        onConfirm={(point) => {
          setPicked(point);
          setAddressError(false);
          setShowMapPicker(false);
          showToast("Ubicación seleccionada en mapa");
        }}
        onCancel={() => setShowMapPicker(false)}
      />
    );
  }

  const isPickup = orderKind === "pickup";

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
            <FaTruckFast size={18} /> {isPickup ? "Despachar Recogida" : "Despachar Entrega"}
          </h2>
          <button className="history-close" onClick={onClose} aria-label="Cerrar modal">
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <form className="dispatch-modal__form" onSubmit={handleSendWhatsApp} noValidate>
          {/* Selector de Tipo de Pedido */}
          <div className="dispatch-kind-selector" role="radiogroup" aria-label="Tipo de Pedido">
            <button
              type="button"
              className={`dispatch-kind-btn ${orderKind === "delivery" ? "is-active" : ""}`}
              onClick={() => {
                setOrderKind("delivery");
                setAddressError(false);
              }}
              role="radio"
              aria-checked={orderKind === "delivery"}
            >
              {orderKind === "delivery" && (
                <motion.div
                  layoutId="dispatch-kind-pill"
                  className="dispatch-kind-pill"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="dispatch-kind-content">
                <FaTruckFast size={14} />
                <span>Entrega</span>
              </span>
            </button>
            <button
              type="button"
              className={`dispatch-kind-btn ${orderKind === "pickup" ? "is-active" : ""}`}
              onClick={() => {
                setOrderKind("pickup");
                setAddressError(false);
              }}
              role="radio"
              aria-checked={orderKind === "pickup"}
            >
              {orderKind === "pickup" && (
                <motion.div
                  layoutId="dispatch-kind-pill"
                  className="dispatch-kind-pill"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="dispatch-kind-content">
                <FaBuilding size={14} />
                <span>Recogida</span>
              </span>
            </button>
          </div>

          {/* Campo Ubicación */}
          <div className="dispatch-field">
            <label className="dispatch-label">
              <PinIcon size={14} />{" "}
              {isPickup ? "Dirección de Recogida / Proveedor *" : "Dirección de Entrega *"}
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
                  className={`dispatch-input ${addressError ? "dispatch-input--error" : ""}`}
                  placeholder={
                    isPickup
                      ? "Ej: Bodega Central, Cra 15 #80-12..."
                      : "Ej: Calle 10 #5-20 o pega enlace de Maps..."
                  }
                  value={addressInput}
                  onChange={(e) => {
                    setAddressInput(e.target.value);
                    if (addressError) setAddressError(false);
                  }}
                  required
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

            {addressError && (
              <div className="dispatch-field-error">
                <AlertIcon width={14} height={14} />
                <span>
                  Ingresa la dirección de {isPickup ? "recogida" : "entrega"} o selecciónala en el mapa
                </span>
              </div>
            )}
          </div>

          {/* Campos Numéricos */}
          <div className="dispatch-field-row">
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="dp-cobro">
                <FaDollarSign size={13} /> {isPickup ? "Recoger del cliente ($)" : "Entregar al cliente ($)"}
              </label>
              <input
                id="dp-cobro"
                type="number"
                className="dispatch-input"
                placeholder={isPickup ? "35000 (cobro en recogida)" : "50000 (cobro en entrega)"}
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
              />
            </div>

            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="dp-viaticos">
                <FaGasPump size={13} /> Viáticos / Envío ($)
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

          {/* Repartidor */}
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

          {/* Notas */}
          <div className="dispatch-field">
            <label className="dispatch-label" htmlFor="dp-notes">
              <FaClipboardList size={13} /> Indicaciones / Notas
            </label>
            <input
              id="dp-notes"
              type="text"
              className="dispatch-input"
              placeholder={
                isPickup
                  ? "Ej: Reclamar Orden #4092, pedir factura"
                  : "Ej: Apto 302, cliente paga en efectivo"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Acciones */}
          <div className="dispatch-modal__actions">
            <button type="submit" className="dispatch-btn dispatch-btn--wa">
              <FaWhatsapp size={18} /> Asignar {isPickup ? "Recogida" : "Entrega"} por WhatsApp
            </button>
            <button
              type="button"
              className="dispatch-btn dispatch-btn--secondary"
              onClick={handleAddToLocalRoute}
            >
              <PlusIcon width={16} height={16} /> Cargar en mi ruta
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
