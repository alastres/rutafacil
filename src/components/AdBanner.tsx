import { useEffect, useRef } from "react";

export type AdProvider = "adsense" | "monetag" | "custom" | "none";

interface AdBannerProps {
  slotId?: string;
  zoneId?: string;
  format?: "auto" | "rectangle" | "horizontal";
  className?: string;
}

/**
 * Componente universal de anuncios para RutaFácil.
 * Totalmente desacoplado: No consume espacio cuando está en "none".
 * Inyecta automáticamente los scripts necesarios al activarse vía Vercel (.env).
 */
export function AdBanner({
  slotId = "1234567890",
  zoneId,
  format = "auto",
  className = "",
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  // Proveedor configurado vía variables de entorno en Vercel (.env)
  const provider: AdProvider = (import.meta.env.VITE_AD_PROVIDER as AdProvider) || "none";
  const pubId = import.meta.env.VITE_ADSENSE_PUB_ID;

  useEffect(() => {
    if (provider === "adsense" && pubId) {
      // 1. Inyectar script de AdSense si no está aún en el DOM
      const scriptId = "adsense-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }

      // 2. Notificar a AdSense para renderizar el bloque
      try {
        // @ts-expect-error Google AdSense global array
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn("AdSense push error:", err);
      }
    }
  }, [provider, pubId]);

  // Si está desactivado o en modo "none", devuelve null (0 píxeles ocupados)
  if (provider === "none") {
    return null;
  }

  // 1. Google AdSense (Se activa al conectar tu dominio propio)
  if (provider === "adsense" && pubId) {
    return (
      <div className={`ad-banner-wrapper ${className}`}>
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: "block", width: "100%" }}
          data-ad-client={pubId}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // 2. Monetag / Redes Alternativas (Funciona en subdominio .vercel.app)
  if (provider === "monetag" && (zoneId || import.meta.env.VITE_MONETAG_ZONE_ID)) {
    const activeZone = zoneId || import.meta.env.VITE_MONETAG_ZONE_ID;
    return (
      <div className={`ad-banner-wrapper ${className}`}>
        <div id={`monetag-zone-${activeZone}`} className="monetag-ad-unit">
          {/* Espacio para la red de anuncios alternativa */}
        </div>
      </div>
    );
  }

  return null;
}
