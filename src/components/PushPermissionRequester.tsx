import { useEffect } from "react";
import { useRouteStore } from "../state/routeStore";

export default function PushPermissionRequester() {
  const markStopDelivered = useRouteStore((s) => s.markStopDelivered);

  useEffect(() => {
    // 1. Pedir permisos de notificación
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            console.log("Permiso de notificaciones concedido.");
          }
        });
      }
    }

    // 2. Registrar Service Worker y escuchar mensajes
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registrado con éxito:", reg.scope);
        })
        .catch((err) => {
          console.error("Fallo al registrar Service Worker:", err);
        });

      // Escuchar mensajes del service worker
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === "DELIVER_STOP") {
          const stopId = event.data.stopId;
          if (stopId) {
            markStopDelivered(stopId);
          }
        }
      };

      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);

      // Escuchar mensajes locales (del fallback clásico)
      const handleWindowMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === "DELIVER_STOP") {
          const stopId = event.data.stopId;
          if (stopId) {
            markStopDelivered(stopId);
          }
        }
      };

      window.addEventListener("message", handleWindowMessage);

      return () => {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
        window.removeEventListener("message", handleWindowMessage);
      };
    }
  }, [markStopDelivered]);

  return null;
}
