import { useEffect, useRef } from "react";
import { FaArrowUpRightFromSquare, FaBullhorn } from "react-icons/fa6";

export type AdProvider = "adsense" | "monetag" | "ethicalads" | "custom" | "none";

interface AdBannerProps {
  slotId?: string;
  zoneId?: string;
  format?: "auto" | "rectangle" | "horizontal";
  customTitle?: string;
  customDesc?: string;
  customLink?: string;
  className?: string;
}

/**
 * Componente universal de publicidad para RutaFácil.
 * Soporta:
 * 1. Monetag (Funciona HOY en subdominio .vercel.app)
 * 2. EthicalAds (Anuncios éticos para herramientas/logística)
 * 3. Banners Propios / Patrocinadores Locales (Personalizables)
 * 4. Google AdSense (Para cuando compres el dominio propio)
 */
export function AdBanner({
  slotId = "1234567890",
  zoneId,
  format = "auto",
  customTitle = "Patrocinado · Anúnciate en RutaFácil",
  customDesc = "Conecta tus servicios de domicilios orepuestos con repartidores en vivo.",
  customLink = "https://rutafacil.app",
  className = "",
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  // Proveedor y llaves configurables vía variables de entorno Vercel (.env)
  const provider: AdProvider = (import.meta.env.VITE_AD_PROVIDER as AdProvider) || "none";
  const pubId = import.meta.env.VITE_ADSENSE_PUB_ID;
  const monetagScriptUrl = import.meta.env.VITE_MONETAG_SCRIPT_URL;
  const ethicalPublisher = import.meta.env.VITE_ETHICALADS_PUBLISHER;

  useEffect(() => {
    // 1. Google AdSense Injection
    if (provider === "adsense" && pubId) {
      const scriptId = "adsense-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }

      try {
        // @ts-expect-error Google AdSense global push
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn("AdSense push error:", err);
      }
    }

    // 2. Monetag Script Injection (Funciona en Vercel)
    if (provider === "monetag" && monetagScriptUrl) {
      const scriptId = "monetag-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = monetagScriptUrl;
        script.async = true;
        document.head.appendChild(script);
      }
    }

    // 3. EthicalAds Script Injection
    if (provider === "ethicalads") {
      const scriptId = "ethicalads-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://media.ethicalads.io/media/client/ethicalads.min.js";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [provider, pubId, monetagScriptUrl]);

  // Si está en "none", devuelve null (0 píxeles consumidos)
  if (provider === "none") {
    return null;
  }

  // A. Google AdSense (Dominio Propio)
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

  // B. Monetag / Redes Alternativas (Funciona en .vercel.app)
  if (provider === "monetag") {
    const activeZone = zoneId || import.meta.env.VITE_MONETAG_ZONE_ID || "default";
    return (
      <div className={`ad-banner-wrapper ${className}`}>
        <div id={`monetag-zone-${activeZone}`} className="monetag-ad-unit">
          {/* Zona renderizada por el script de Monetag */}
        </div>
      </div>
    );
  }

  // C. EthicalAds (Anuncios Tech/Logística)
  if (provider === "ethicalads" && ethicalPublisher) {
    return (
      <div className={`ad-banner-wrapper ${className}`}>
        <div
          className="horizontal"
          data-ea-publisher={ethicalPublisher}
          data-ea-type="image"
          data-ea-style="stickybox"
        />
      </div>
    );
  }

  // D. Banner Propio / Patrocinador Local (Personalizable hoy)
  if (provider === "custom") {
    return (
      <div className={`ad-banner-wrapper ${className}`}>
        <a
          href={customLink}
          target="_blank"
          rel="noopener noreferrer"
          className="custom-ad-card"
        >
          <span className="custom-ad-badge">
            <FaBullhorn size={10} style={{ marginRight: 3 }} /> Anuncio
          </span>
          <div className="custom-ad-info">
            <div className="custom-ad-title">{customTitle}</div>
            <div className="custom-ad-desc">{customDesc}</div>
          </div>
          <FaArrowUpRightFromSquare size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
        </a>
      </div>
    );
  }

  return null;
}
