# RutaFácil

PWA para repartidores: comparte ubicaciones desde WhatsApp (o cualquier app) al menú
Compartir de Android, y RutaFácil arma la ruta de entregas más corta partiendo de tu
ubicación — menos combustible, menos tiempo.

## Cómo funciona

1. Te comparten una ubicación por WhatsApp.
2. La abres → Compartir → **RutaFácil** (la PWA instalada aparece en el menú del sistema).
3. Repites con cada pedido. Al salir, tocas **Armar ruta**.
4. La app ordena las paradas (vecino más cercano + 2-opt sobre haversine, on-device,
   sin APIs de pago) y te guía parada por parada: **Navegar** abre Google Maps,
   **Entregada** marca y pasa a la siguiente.

## Stack

| Capa | Elección | Por qué |
| --- | --- | --- |
| Build | Vite 6 + TypeScript estricto | rápido, estándar, mantenible |
| UI | React 18 + Motion (animaciones) | ecosistema, migración directa a Expo si hace falta |
| Estado | Zustand + persist (localStorage) | mínimo, sin backend |
| PWA | vite-plugin-pwa (`share_target` en el manifest) | la app aparece en el menú Compartir de Android |
| Mapa | MapLibre GL + teselas OSM | $0, sin llaves de API |
| Tests | Vitest (parser y optimizador) | el motor es lo crítico |

**Costo de operación: $0.** Todo corre en el dispositivo; el hosting estático entra
en cualquier free tier (Vercel, Netlify, Cloudflare Pages).

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests del motor (parser + TSP)
npm run build    # type-check + build de producción + service worker
```

Para probar el share target se necesita HTTPS + instalación: despliega `dist/` en
cualquier host estático, abre en Chrome Android e instala ("Agregar a pantalla de
inicio"). El share target **no funciona** en `localhost` sin instalar.

## Limitaciones conocidas (con plan)

- **Enlaces acortados** (`maps.app.goo.gl`): el navegador no puede resolver la
  redirección (CORS). La app lo detecta y pide compartir desde Maps directamente.
  Plan: Cloudflare Worker gratuito que resuelva la redirección (fase 2 del PLAN).
- **Distancias en línea recta**: el orden se calcula con haversine, no por calles.
  Plan: openrouteservice (free tier, 40k req/mes) cuando el piloto lo pida.
- **iOS**: Safari no soporta `share_target`; la entrada manual (pegar enlace) sí
  funciona. El mercado objetivo inicial es Android.

Ver [PLAN.md](PLAN.md) para el plan completo por fases.
