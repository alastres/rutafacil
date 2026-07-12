import { useRouteStore } from "../state/routeStore";
import type { TransportMode } from "../lib/routing";

const MODES: { value: TransportMode; label: string; icon: string }[] = [
  { value: "car", label: "Auto", icon: "🚗" },
  { value: "motorbike", label: "Moto", icon: "🏍️" },
  { value: "bike", label: "Bici", icon: "🚲" },
  { value: "foot", label: "Pie", icon: "🚶" },
];

export function ModeSelector() {
  const mode = useRouteStore((s) => s.mode);
  const setMode = useRouteStore((s) => s.setMode);

  return (
    <div className="mode-selector" role="group" aria-label="Modo de transporte">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={`mode-btn${mode === m.value ? " is-active" : ""}`}
          aria-pressed={mode === m.value}
          onClick={() => setMode(m.value)}
        >
          <span aria-hidden="true">{m.icon}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
