import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA, type ManifestOptions } from "vite-plugin-pwa";

// share_target: al instalarse, la PWA aparece en el menú Compartir de Android.
// En Android el enlace compartido llega en el parámetro `text` (no en `url`).
const manifest: Partial<ManifestOptions> = {
  id: "/",
  name: "RutaFácil",
  short_name: "RutaFácil",
  description:
    "Comparte ubicaciones desde WhatsApp y arma la ruta de entregas más corta.",
  lang: "es",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#E9E7E2",
  theme_color: "#211E1A",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  share_target: {
    action: "/",
    method: "GET",
    params: { title: "title", text: "text", url: "url" },
  },
} as Partial<ManifestOptions>;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest,
      workbox: {
        importScripts: ["/sw-monetag.js"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map\/MapServer\/tile\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "esri-tiles-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/(routing\.openstreetmap\.de|router\.project-osrm\.org)\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "osrm-route-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/maplibre-gl")) {
            return "vendor-maplibre";
          }
          if (id.includes("node_modules/motion")) {
            return "vendor-motion";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/zustand/")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
