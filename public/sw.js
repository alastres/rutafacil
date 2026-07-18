self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const stopId = event.notification.data?.stopId;
  if (!stopId) return;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      matchingClient = windowClient;
      break;
    }

    if (matchingClient) {
      // Si la pestaña está abierta, enfocar y notificarle para marcar entregado
      return matchingClient.focus().then((client) => {
        client.postMessage({
          type: "DELIVER_STOP",
          stopId: stopId
        });
      });
    } else {
      // Si está cerrada, abrir la app y mandarle el mensaje tras un breve delay
      return clients.openWindow('/').then((client) => {
        if (client) {
          setTimeout(() => {
            client.postMessage({
              type: "DELIVER_STOP",
              stopId: stopId
            });
          }, 1500);
        }
      });
    }
  });

  event.waitUntil(promiseChain);
});
