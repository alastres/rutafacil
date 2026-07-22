import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import PushPermissionRequester from "./components/PushPermissionRequester";
import BackSwipeHandler from "./components/BackSwipeHandler";
import { parseAllLocations, parseSharedText, parseSmartLinkParams } from "./lib/parse";
import { resolveShortLink } from "./lib/resolve";
import { ensurePersistentStorage } from "./lib/historyDb";
import { showToast } from "./lib/toast";
import { useRouteStore } from "./state/routeStore";
import { withLoader } from "./state/loadingStore";
import { Header } from "./components/Header";
import { DispatchModal } from "./components/DispatchModal";
import { AddStop } from "./components/AddStop";
import { ReturnPointTrigger } from "./components/ReturnPointSheet";
import { EmptyState } from "./components/EmptyState";
import { OptimizeBar } from "./components/OptimizeBar";
import { StopsOffcanvas } from "./components/StopsOffcanvas";
import { LiveTracker } from "./components/LiveTracker";
import { NavigationBanner } from "./components/NavigationBanner";
import { ModeSelector } from "./components/ModeSelector";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalLoader } from "./components/GlobalLoader";
import { CheckIcon, AlertIcon } from "./components/icons";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const MapView = lazy(() => import("./components/MapView"));

export default function App() {
  const stops = useRouteStore((s) => s.stops);
  const addStop = useRouteStore((s) => s.addStop);
  const addEnrichedStop = useRouteStore((s) => s.addEnrichedStop);
  const [showList, setShowList] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const notify = useCallback((text: string, error = false) => {
    showToast(text, {
      icon: error ? <AlertIcon width={18} height={18} /> : <CheckIcon width={18} height={18} />,
      className: error ? "rht rht--error" : "rht",
    });
  }, []);

  /**
   * Procesa texto compartido o pegado.
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
        const finals = await withLoader(() =>
          Promise.all(shortLinks.map(resolveShortLink)),
        );
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
          ? "Parada agregada a la ruta"
          : `${locations.length} paradas agregadas a la ruta`;
      notify(
        unresolved > 0
          ? `${added} (${unresolved} enlace${unresolved > 1 ? "s" : ""} acortado sin resolver)`
          : added,
      );
      return true;
    },
    [addStop, notify],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const smartLink = parseSmartLinkParams(params);
    if (smartLink) {
      addEnrichedStop({
        lat: smartLink.lat,
        lng: smartLink.lng,
        label: smartLink.label || "Parada cargada",
        collectAmount: smartLink.collectAmount,
        travelAllowance: smartLink.travelAllowance,
        notes: smartLink.notes,
        assignee: smartLink.assignee,
      });
      const extraMsg = smartLink.collectAmount ? ` (Cobro: $${smartLink.collectAmount.toLocaleString("es-CO")})` : "";
      notify(`Pedido de WhatsApp cargado: ${smartLink.label || "Parada"}${extraMsg}`);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const shared = [params.get("title"), params.get("text"), params.get("url")]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (shared) {
      void ingest(shared);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [addEnrichedStop, ingest, notify]);

  useEffect(() => {
    void ensurePersistentStorage();
  }, []);

  const hasStops = stops.length > 0;

  return (
    <BackSwipeHandler>
      <ErrorBoundary>
        <div className={`app-container${hasStops ? " has-stops" : " is-empty"}`}>
          <GlobalLoader />
          <Header onOpenDispatch={() => setShowDispatchModal(true)} />
          <NavigationBanner />
          {showDispatchModal && <DispatchModal onClose={() => setShowDispatchModal(false)} />}

          {!hasStops && (
            <>
              <AddStop onSubmit={ingest} onNotify={notify} />
              <div className="controls-bar">
                <ReturnPointTrigger onNotify={notify} />
                <ModeSelector />
              </div>
            </>
          )}

          {hasStops ? (
            <div className="map-container-fill">
              <Suspense fallback={<div className="map-wrap map-wrap--fill" />}>
                <MapView />
              </Suspense>
              <div className="map-floating-controls">
                <ReturnPointTrigger onNotify={notify} />
                <ModeSelector />
              </div>
            </div>
          ) : (
            <EmptyState />
          )}

          {hasStops && (
            <StopsOffcanvas
              open={showList}
              moving={moving}
              onClose={() => setShowList(false)}
              onAddStop={ingest}
              onNotify={notify}
            />
          )}

          <OptimizeBar
            onNotify={notify}
            onMoving={setMoving}
            onToggleList={() => setShowList((v) => !v)}
          />
          <LiveTracker />
          <PWAInstallBanner />

          <Toaster
            position="bottom-center"
            containerStyle={{ bottom: 92, left: 0, right: 0 }}
            toastOptions={{
              duration: 4000,
              className: "rht",
              style: {
                background: "var(--asfalto)",
                color: "var(--pintura-blanca)",
                borderLeft: "6px solid var(--pintura)",
                borderRadius: "var(--radius)",
                fontFamily: "var(--font-body)",
                fontSize: "0.92rem",
                maxWidth: "432px",
                boxShadow: "0 10px 30px rgba(33, 30, 26, 0.35)",
              },
            }}
          />
          <PushPermissionRequester />
        </div>
      </ErrorBoundary>
    </BackSwipeHandler>
  );
}
