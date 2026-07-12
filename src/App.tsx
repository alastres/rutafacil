import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { parseAllLocations, parseSharedText } from "./lib/parse";
import { resolveShortLink } from "./lib/resolve";
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

  /**
   * Procesa texto compartido o pegado — puede traer VARIAS ubicaciones
   * (una conversación entera de WhatsApp). Los enlaces acortados se
   * resuelven vía /api/resolve. Devuelve true si agregó alguna parada.
   */
  const ingest = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text.trim()) {
        notify("El campo está vacío: pega un enlace de Maps o coordenadas.", true);
        return false;
      }

      const { locations, shortLinks } = parseAllLocations(text);

      let unresolved = 0;
      if (shortLinks.length > 0) {
        const finals = await Promise.all(shortLinks.map(resolveShortLink));
        for (const finalUrl of finals) {
          const r = finalUrl ? parseSharedText(finalUrl) : { kind: "none" as const };
          if (r.kind === "ok") locations.push({ lat: r.lat, lng: r.lng, label: r.label });
          else unresolved++;
        }
      }

      if (locations.length === 0) {
        notify(
          unresolved > 0
            ? "No pude resolver el enlace acortado. Ábrelo en Maps y comparte desde ahí."
            : "No encontré ninguna ubicación en el texto.",
          true,
        );
        return false;
      }

      for (const loc of locations) addStop(loc.lat, loc.lng, loc.label);
      const added =
        locations.length === 1
          ? "Parada agregada a la ruta ✓"
          : `${locations.length} paradas agregadas a la ruta ✓`;
      notify(
        unresolved > 0
          ? `${added} (${unresolved} enlace${unresolved > 1 ? "s" : ""} acortado sin resolver)`
          : added,
      );
      return true;
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
      void ingest(shared);
      window.history.replaceState(null, "", "/");
    }
    // Solo al cargar la app
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header />
      <AddStop onSubmit={ingest} onNotify={notify} />
      {showMap && stops.length > 0 && (
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
