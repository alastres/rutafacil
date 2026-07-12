import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA, type ManifestOptions } from "vite-plugin-pwa";

// share_target: al instalarse, la PWA aparece en el menú Compartir de Android.
// En Android el enlace compartido llega en el parámetro `text` (no en `url`).
const manifest: Partial<ManifestOptions> = {
  name: "RutaFácil",
  short_name: "RutaFácil",
  description:
    "Comparte ubicaciones desde WhatsApp y arma la ruta de entregas más corta.",
  lang: "es",
  start_url: "/",
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
    }),
  ],
});
