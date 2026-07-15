// vite.config.ts
import { defineConfig } from "file:///D:/Datos/Documentos/Proyectos/Daniel/rutafacil/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Datos/Documentos/Proyectos/Daniel/rutafacil/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///D:/Datos/Documentos/Proyectos/Daniel/rutafacil/node_modules/vite-plugin-pwa/dist/index.js";
var manifest = {
  id: "/",
  name: "RutaF\xE1cil",
  short_name: "RutaF\xE1cil",
  description: "Comparte ubicaciones desde WhatsApp y arma la ruta de entregas m\xE1s corta.",
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
      purpose: "maskable"
    }
  ],
  share_target: {
    action: "/",
    method: "GET",
    params: { title: "title", text: "text", url: "url" }
  }
};
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxEYXRvc1xcXFxEb2N1bWVudG9zXFxcXFByb3llY3Rvc1xcXFxEYW5pZWxcXFxccnV0YWZhY2lsXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxEYXRvc1xcXFxEb2N1bWVudG9zXFxcXFByb3llY3Rvc1xcXFxEYW5pZWxcXFxccnV0YWZhY2lsXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9EYXRvcy9Eb2N1bWVudG9zL1Byb3llY3Rvcy9EYW5pZWwvcnV0YWZhY2lsL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCB7IFZpdGVQV0EsIHR5cGUgTWFuaWZlc3RPcHRpb25zIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiO1xuXG4vLyBzaGFyZV90YXJnZXQ6IGFsIGluc3RhbGFyc2UsIGxhIFBXQSBhcGFyZWNlIGVuIGVsIG1lblx1MDBGQSBDb21wYXJ0aXIgZGUgQW5kcm9pZC5cbi8vIEVuIEFuZHJvaWQgZWwgZW5sYWNlIGNvbXBhcnRpZG8gbGxlZ2EgZW4gZWwgcGFyXHUwMEUxbWV0cm8gYHRleHRgIChubyBlbiBgdXJsYCkuXG5jb25zdCBtYW5pZmVzdDogUGFydGlhbDxNYW5pZmVzdE9wdGlvbnM+ID0ge1xuICBpZDogXCIvXCIsXG4gIG5hbWU6IFwiUnV0YUZcdTAwRTFjaWxcIixcbiAgc2hvcnRfbmFtZTogXCJSdXRhRlx1MDBFMWNpbFwiLFxuICBkZXNjcmlwdGlvbjpcbiAgICBcIkNvbXBhcnRlIHViaWNhY2lvbmVzIGRlc2RlIFdoYXRzQXBwIHkgYXJtYSBsYSBydXRhIGRlIGVudHJlZ2FzIG1cdTAwRTFzIGNvcnRhLlwiLFxuICBsYW5nOiBcImVzXCIsXG4gIHN0YXJ0X3VybDogXCIvXCIsXG4gIHNjb3BlOiBcIi9cIixcbiAgZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXG4gIG9yaWVudGF0aW9uOiBcInBvcnRyYWl0XCIsXG4gIGJhY2tncm91bmRfY29sb3I6IFwiI0U5RTdFMlwiLFxuICB0aGVtZV9jb2xvcjogXCIjMjExRTFBXCIsXG4gIGljb25zOiBbXG4gICAgeyBzcmM6IFwiaWNvbnMvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiB9LFxuICAgIHsgc3JjOiBcImljb25zL2ljb24tNTEyLnBuZ1wiLCBzaXplczogXCI1MTJ4NTEyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIgfSxcbiAgICB7XG4gICAgICBzcmM6IFwiaWNvbnMvaWNvbi01MTIucG5nXCIsXG4gICAgICBzaXplczogXCI1MTJ4NTEyXCIsXG4gICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxuICAgICAgcHVycG9zZTogXCJtYXNrYWJsZVwiLFxuICAgIH0sXG4gIF0sXG4gIHNoYXJlX3RhcmdldDoge1xuICAgIGFjdGlvbjogXCIvXCIsXG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgIHBhcmFtczogeyB0aXRsZTogXCJ0aXRsZVwiLCB0ZXh0OiBcInRleHRcIiwgdXJsOiBcInVybFwiIH0sXG4gIH0sXG59IGFzIFBhcnRpYWw8TWFuaWZlc3RPcHRpb25zPjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiaWNvbnMvaWNvbi5zdmdcIl0sXG4gICAgICBtYW5pZmVzdCxcbiAgICB9KSxcbiAgXSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF3VSxTQUFTLG9CQUFvQjtBQUNyVyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFxQztBQUk5QyxJQUFNLFdBQXFDO0FBQUEsRUFDekMsSUFBSTtBQUFBLEVBQ0osTUFBTTtBQUFBLEVBQ04sWUFBWTtBQUFBLEVBQ1osYUFDRTtBQUFBLEVBQ0YsTUFBTTtBQUFBLEVBQ04sV0FBVztBQUFBLEVBQ1gsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLEVBQ1QsYUFBYTtBQUFBLEVBQ2Isa0JBQWtCO0FBQUEsRUFDbEIsYUFBYTtBQUFBLEVBQ2IsT0FBTztBQUFBLElBQ0wsRUFBRSxLQUFLLHNCQUFzQixPQUFPLFdBQVcsTUFBTSxZQUFZO0FBQUEsSUFDakUsRUFBRSxLQUFLLHNCQUFzQixPQUFPLFdBQVcsTUFBTSxZQUFZO0FBQUEsSUFDakU7QUFBQSxNQUNFLEtBQUs7QUFBQSxNQUNMLE9BQU87QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxJQUNYO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsUUFBUSxFQUFFLE9BQU8sU0FBUyxNQUFNLFFBQVEsS0FBSyxNQUFNO0FBQUEsRUFDckQ7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxnQkFBZ0I7QUFBQSxNQUNoQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
