import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { parseAllLocations, parseSharedText } from "./lib/parse";
import { resolveShortLink } from "./lib/resolve";
import { ensurePersistentStorage } from "./lib/historyDb";
import { useRouteStore } from "./state/routeStore";
import { withLoader } from "./state/loadingStore";
import { Header } from "./components/Header";
import { AddStop } from "./components/AddStop";
import { ReturnPointTrigger } from "./components/ReturnPointSheet";
import { EmptyState } from "./components/EmptyState";
import { RoadList } from "./components/RoadList";
import { OptimizeBar } from "./components/OptimizeBar";
import { LiveTracker } from "./components/LiveTracker";
import { ModeSelector } from "./components/ModeSelector";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalLoader } from "./components/GlobalLoader";
import { CheckIcon, AlertIcon } from "./components/icons";
import { SubscriptionModal } from "./components/SubscriptionModal";
import { AuthModal } from "./components/AuthModal";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const MapView = lazy(() => import("./components/MapView"));

export default function App() {
  const stops = useRouteStore((s) => s.stops);
  const addStop = useRouteStore((s) => s.addStop);
  const userTier = useRouteStore((s) => s.userTier);
  const setUserTier = useRouteStore((s) => s.setUserTier);
  const setSubscriptionModalOpen = useRouteStore((s) => s.setSubscriptionModalOpen);
  const [showMap, setShowMap] = useState(false);
  const [moving, setMoving] = useState(false);

  const notify = useCallback((text: string, error = false) => {
    toast(text, {
      icon: error ? <AlertIcon width={18} height={18} /> : <CheckIcon width={18} height={18} />,
      className: error ? "rht rht--error" : "rht",
    });
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

      let locationsToAdd = locations;
      let truncated = false;

      if (userTier === "free") {
        const currentStopsCount = stops.length;
        if (currentStopsCount >= 8) {
          notify("Límite de paradas alcanzado (máx. 8). ¡Suscríbete a Pro para paradas ilimitadas!", true);
          setSubscriptionModalOpen(true);
          return false;
        }
        if (currentStopsCount + locations.length > 8) {
          const allowed = 8 - currentStopsCount;
          locationsToAdd = locations.slice(0, allowed);
          truncated = true;
        }
      }

      for (const loc of locationsToAdd) addStop(loc.lat, loc.lng, loc.label);

      if (truncated) {
        notify(`Límite del plan Gratuito alcanzado. Se agregaron solo las primeras ${locationsToAdd.length} ubicaciones. ¡Pásate a Pro para agregar paradas ilimitadas!`, true);
        setSubscriptionModalOpen(true);
        return true;
      }

      const added =
        locationsToAdd.length === 1
          ? "Parada agregada a la ruta"
          : `${locationsToAdd.length} paradas agregadas a la ruta`;
      notify(
        unresolved > 0
          ? `${added} (${unresolved} enlace${unresolved > 1 ? "s" : ""} acortado sin resolver)`
          : added,
      );
      return true;
    },
    [addStop, notify, userTier, stops.length, setSubscriptionModalOpen],
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

  // Pide almacenamiento persistente para que el navegador no borre el
  // historial (IndexedDB) automáticamente si necesita liberar espacio.
  useEffect(() => {
    void ensurePersistentStorage();
  }, []);

  // Escuchar parámetros de retorno de pasarelas de pago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const status = params.get("status");

    if (sessionId === "mock_success" || status === "approved") {
      setUserTier("pro");
      notify("¡Gracias por suscribirte a RutaFácil PRO! Acceso Premium activado.");
      window.history.replaceState(null, "", "/");
    } else if (status === "cancelled" || status === "failed") {
      notify("El proceso de pago fue cancelado o falló.", true);
      window.history.replaceState(null, "", "/");
    }
  }, [setUserTier, notify]);

  // Validación silenciosa del JWT y la Suscripción al arrancar
  useEffect(() => {
    const token = localStorage.getItem("rutafacil_jwt");
    if (!token) return;

    fetch("/api/subscription-status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: any) => {
        if (data.isSubscribed) {
          // El token sigue siendo válido y es PRO
          useRouteStore.getState().loginUser(data.email || "", token, "pro");
        } else {
          // Degradación si la suscripción de Stripe venció/canceló o es free
          useRouteStore.getState().loginUser(data.email || "", token, "free");
        }
      })
      .catch(() => {
        // Fallback de desarrollo para JWT simulados
        if ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && token?.startsWith("header.")) {
          try {
            const payloadStr = atob(token.split(".")[1]);
            const payload = JSON.parse(payloadStr);
            useRouteStore.getState().loginUser(payload.email || "", token, payload.tier || "free");
          } catch {
            useRouteStore.getState().logoutUser();
          }
        } else {
          // Si el token es inválido o expiró
          useRouteStore.getState().logoutUser();
        }
      });
  }, []);

  return (
    <ErrorBoundary>
      <GlobalLoader />
      <Header />
      <AddStop onSubmit={ingest} />
      {(!showMap || stops.length === 0) && (
        <div className="controls-bar">
          <ReturnPointTrigger onNotify={notify} />
          <ModeSelector />
        </div>
      )}
      {showMap && stops.length > 0 && (
        <div className="map-container-relative">
          <Suspense fallback={<div className="map-wrap" />}>
            <MapView />
          </Suspense>
          <div className="map-floating-controls">
            <ReturnPointTrigger onNotify={notify} />
            <ModeSelector />
          </div>
        </div>
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
      <LiveTracker />
      <SubscriptionModal />
      <AuthModal />
      <OnboardingTutorial />
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
    </ErrorBoundary>
  );
}
