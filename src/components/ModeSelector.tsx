import { useRef, useState } from "react";
import type { IconType } from "react-icons";
import { useRouteStore } from "../state/routeStore";
import { useLoadingStore } from "../state/loadingStore";
import type { TransportMode } from "../lib/routing";
import { CarIcon, MotorbikeIcon, BikeIcon, WalkIcon } from "./icons";

const MODES: {
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
  // recálculo automático en vivo ya están pidiendo una ruta, y así ahorra
  // peticiones que de todos modos se descartarían.
  const appLoading = useLoadingStore((s) => s.count > 0);
  const [changing, setChanging] = useState(false);
  // Candado síncrono, independiente del ciclo de render de React: rechaza
  // un segundo clic en el mismo instante, antes de que `disabled` llegue a
  // pintarse en el DOM (más estricto que confiar solo en el atributo).
  const clickLock = useRef(false);

  const handleClick = async (value: TransportMode) => {
    if (value === mode || clickLock.current || appLoading) return;
    clickLock.current = true;
    setChanging(true);
    try {
      await setMode(value);
    } finally {
      clickLock.current = false;
      setChanging(false);
    }
  };

  const disabled = changing || appLoading;

  return (
    <div className="mode-selector" role="group" aria-label="Modo de transporte">
      {MODES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className={`mode-btn${mode === value ? " is-active" : ""}`}
          aria-pressed={mode === value}
          disabled={disabled}
          onClick={() => void handleClick(value)}
        >
          <Icon width={20} height={20} />
          {label}
        </button>
      ))}
    </div>
  );
}
