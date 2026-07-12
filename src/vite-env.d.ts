/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Servidor OSRM propio (o proxy) para reemplazar los servidores públicos. */
  readonly VITE_OSRM_BASE?: string;
  /**
   * Proveedor de ruteo con tráfico en vivo (opcional, de paga).
   * "mapbox" usa VITE_MAPBOX_KEY. Si no está configurado, se usa OSRM gratis.
   */
  readonly VITE_ROUTING_PROVIDER?: "osrm" | "mapbox";
  readonly VITE_MAPBOX_KEY?: string;
  /** Llave de TomTom para marcadores de incidencias (opcional). */
  readonly VITE_TOMTOM_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
