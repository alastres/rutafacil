# Plan de producto — RutaFácil

Objetivo: validar con repartidores reales que capturar paradas vía Compartir y
optimizar la ruta ahorra tiempo/combustible, gastando $0 en infraestructura hasta
tener tracción.

## Fase 0 — Fundamentos ✅ (hecha)

- Repo con Vite + React + TS estricto, tests del motor, PWA con `share_target`.
- Parser de ubicaciones (geo:, Google Maps, Waze, coordenadas, detección de
  enlaces cortos) y optimizador TSP on-device (NN + 2-opt).
- UI "señalética vial" con animaciones (reordenamiento con resortes, carretera
  viva, sello de entrega).

## Fase 1 — Prototipo instalable (semana 1)

- [ ] Deploy a hosting estático con HTTPS (Cloudflare Pages / Vercel / Netlify, free tier).
- [ ] Instalar en un Android real y probar el share target con WhatsApp, Google Maps y Waze.
- [ ] Ajustar el parser con los formatos reales que aparezcan (los enlaces varían por región).
- **Criterio de salida:** compartir una ubicación desde WhatsApp agrega la parada en ≤3 toques.

## Fase 2 — Piloto (semanas 2–3)

- [ ] Worker gratuito (Cloudflare, 100k req/día) para resolver enlaces `maps.app.goo.gl`.
- [ ] 3–5 repartidores reales usándola a diario; canal de feedback por WhatsApp.
- [ ] Contadores locales de uso (rutas armadas, paradas promedio, km estimados ahorrados).
- **Criterio de salida:** ≥3 usuarios arman ruta ≥4 días por semana sin ayuda.

## Fase 3 — Decisión de tracción (mes 2)

Si el piloto valida:
- [ ] Rutas por calles reales con openrouteservice (free tier: 2.5k req/día).
- [ ] Rutas guardadas, punto de retorno configurable, compartir ruta.
- [ ] Monetización: gratis hasta ~10 paradas; premium B2B (negocios con varios
      repartidores) cobrado fuera de la app (MercadoPago/local).

Si no valida: post-mortem con los datos del piloto antes de invertir más.

## Fase 4 — Escala (cuando el free tier quede corto)

- VROOM + OSRM self-hosted (Oracle Cloud Always Free o VPS ~$5/mes).
- Evaluar app nativa (el código React migra a Expo casi directo) solo si la
  Play Store aporta distribución real.

## Riesgos vigilados

| Riesgo | Señal | Mitigación |
| --- | --- | --- |
| Formatos de enlaces cambian | parser falla con enlaces reales | tests + fase 1 dedicada a formatos |
| "Agregar a pantalla de inicio" confunde | usuarios no instalan solos | guía visual de 3 pasos + acompañar la primera instalación |
| Haversine ordena mal en ciudades partidas | quejas de orden "raro" | pasar a openrouteservice (fase 3) |
| iOS queda fuera | demanda de usuarios iPhone | entrada manual funciona; share target nativo → Expo (fase 4) |
