/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Servidor OSRM propio (o proxy) para reemplazar los servidores públicos. */
  readonly VITE_OSRM_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
