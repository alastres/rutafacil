import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { parseSharedText } from "./lib/parse";
import { useRouteStore } from "./state/routeStore";
import { Header } from "./components/Header";
import { AddStop } from "./components/AddStop";
import { EmptyState } from "./components/EmptyState";
import { RoadList } from "./components/RoadList";
import { OptimizeBar } from "./components/OptimizeBar";

const MapView = lazy(() => import("./components/MapView"));

export interface Toast {
  text: string;
  error?: boolean;
}

export default function App() {
  const stops = useRouteStore((s) => s.stops);
  const addStop = useRouteStore((s) => s.addStop);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [moving, setMoving] = useState(false);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  /** Procesa texto compartido o pegado; devuelve true si agregó parada. */
  const ingest = useCallback(
    (text: string): boolean => {
      const result = parseSharedText(text);
      if (result.kind === "ok") {
        addStop(result.lat, result.lng, result.label);
        notify("Parada agregada a la ruta ✓");
        return true;
      }
      if (result.kind === "short-link") {
        notify(
          "Ese enlace es acortado y no trae coordenadas. Ábrelo en Maps y comparte desde ahí.",
          true,
        );
        return false;
      }
      notify("No encontré una ubicación en lo que compartiste.", true);
      return false;
    },
    [addStop, notify],
  );

  // Entrada por el menú Compartir de Android (share_target del manifest):
  // el enlace llega en ?text= (a veces en ?url= o ?title=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = [params.get("title"), params.get("text"), params.get("url")]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (shared) {
      ingest(shared);
      window.history.replaceState(null, "", "/");
    }
    // Solo al cargar la app
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header />
      <AddStop onSubmit={ingest} />
      {showMap && (
        <Suspense fallback={<div className="map-wrap" />}>
          <MapView />
        </Suspense>
      )}
      {stops.length === 0 ? (
        <EmptyState />
      ) : (
        <RoadList moving={moving} />
      )}
      <OptimizeBar
        onNotify={notify}
        onMoving={setMoving}
        showMap={showMap}
        onToggleMap={() => setShowMap((v) => !v)}
      />
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast${toast.error ? " is-error" : ""}`}
            role="status"
            initial={{ opacity: 0, y: -24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -24, x: "-50%" }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
