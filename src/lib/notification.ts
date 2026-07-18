import type { Stop } from "../state/routeStore";

// Registro en memoria de las paradas sobre las que ya notificamos la llegada
// para no spamear al usuario si el GPS fluctúa en el mismo lugar.
const notifiedStops = new Set<string>();

export async function triggerArrivalNotification(stop: Stop) {
  if (notifiedStops.has(stop.id)) {
    return;
  }
  notifiedStops.add(stop.id);

  if (!("Notification" in window)) {
    console.warn("Notifications not supported in this browser.");
    return;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission is not granted.");
    return;
  }

  // 1. Intentar por Service Worker (Recomendado para móviles / segundo plano)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(`Has llegado a la parada`, {
        body: stop.label,
        tag: `arrival-${stop.id}`,
        renotify: true,
        data: { stopId: stop.id },
        icon: "/icons/icon-192x192.png", // Icono por defecto de la PWA
        vibrate: [200, 100, 200],
        badge: "/icons/icon-192x192.png"
      } as any);
      return;
    } catch (err) {
      console.error("Error enviando notificación via Service Worker, intentando fallback:", err);
    }
  }

  // 2. Fallback clásico de primer plano (Notification API)
  try {
    const notification = new Notification(`Has llegado a la parada`, {
      body: stop.label,
      tag: `arrival-${stop.id}`,
      data: { stopId: stop.id },
    });

    notification.onclick = () => {
      // En fallback, enviamos el mensaje al window actual directamente
      window.postMessage({ type: "DELIVER_STOP", stopId: stop.id }, "*");
      notification.close();
    };
  } catch (err) {
    console.error("Error al mostrar notificación con Notification API clásica:", err);
  }
}

/** Permite limpiar el registro de notificaciones enviadas si vaciamos la ruta */
export function clearNotifiedStops() {
  notifiedStops.clear();
}
