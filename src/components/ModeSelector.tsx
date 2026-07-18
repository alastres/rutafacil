import { useRef, useState, useEffect } from "react";
import type { IconType } from "react-icons";
import { useRouteStore } from "../state/routeStore";
import { useLoadingStore } from "../state/loadingStore";
import type { TransportMode } from "../lib/routing";
import { CarIcon, MotorbikeIcon, BikeIcon, WalkIcon, ChevronDownIcon } from "./icons";

/** Datos de cada modo de transporte; se reutiliza en la vista de detalle
 * del historial para mostrar el mismo ícono/nombre del vehículo usado. */
export const MODES: {
  value: TransportMode;
  label: string;
  Icon: IconType;
}[] = [
  { value: "car", label: "Auto", Icon: CarIcon },
  { value: "motorbike", label: "Moto", Icon: MotorbikeIcon },
  { value: "bike", label: "Bici", Icon: BikeIcon },
  { value: "foot", label: "Pie", Icon: WalkIcon },
];

export function ModeSelector() {
  const mode = useRouteStore((s) => s.mode);
  const setMode = useRouteStore((s) => s.setMode);
  // Bloquea los botones mientras haya CUALQUIER carga en curso (no solo la
  // propia): evita elegir otro vehículo mientras "Armar ruta" o el
  // recálculo automático en vivo ya están pidiendo una ruta.
  const appLoading = useLoadingStore((s) => s.count > 0);
  const [changing, setChanging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const clickLock = useRef(false);

  const handleClick = async (value: TransportMode) => {
    if (value === mode || clickLock.current || appLoading) {
      setIsOpen(false);
      return;
    }
    clickLock.current = true;
    setChanging(true);
    setIsOpen(false);
    try {
      await setMode(value);
    } finally {
      clickLock.current = false;
      setChanging(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentMode = MODES.find((m) => m.value === mode) || MODES[0];
  const CurrentIcon = currentMode.Icon;
  const disabled = changing || appLoading;

  return (
    <div className="mode-dropdown-container" ref={dropdownRef}>
      <button
        type="button"
        className="mode-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <CurrentIcon width={16} height={16} />
        <span>{currentMode.label}</span>
        <ChevronDownIcon width={12} height={12} className={`caret ${isOpen ? "open" : ""}`} />
      </button>

      {isOpen && (
        <ul className="mode-dropdown-menu" role="listbox">
          {MODES.map(({ value, label, Icon }) => (
            <li key={value} role="option" aria-selected={mode === value}>
              <button
                type="button"
                className={`mode-dropdown-item${mode === value ? " is-active" : ""}`}
                onClick={() => void handleClick(value)}
              >
                <Icon width={16} height={16} />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
