import { useEffect, useRef } from "react";
import { FaArrowUpRightFromSquare, FaBullhorn } from "react-icons/fa6";

export type AdProvider = "adsense" | "monetag" | "ethicalads" | "adsterra" | "custom" | "none";

interface AdBannerProps {
  slotId?: string;
  zoneId?: string;
  adsterraKey?: string;
  adsterraSize?: "320x50" | "300x250";
  format?: "auto" | "rectangle" | "horizontal";
  customTitle?: string;
  customDesc?: string;
  customLink?: string;
  className?: string;
}

/**
 * Componente universal de publicidad para RutaFácil.
 * Soporta:
 * 1. Adsterra (Banners limpios 320x50 y 300x250 activados por defecto)
 * 2. Monetag (Notificaciones e In-Page Push)
 * 3. EthicalAds (Anuncios éticos para herramientas/logística)
 * 4. Banners Propios / Patrocinadores Locales (Personalizables)
 * 5. Google AdSense (Para cuando compres el dominio propio)
 */
export function AdBanner({
  slotId = "1234567890",
  zoneId,
  adsterraKey,
  adsterraSize,
  format = "auto",
  customTitle = "Patrocinado · Anúnciate en RutaFácil",
  customDesc = "Conecta tus servicios de domicilios o repuestos con repartidores en vivo.",
  customLink = "https://rutafacil.app",
  className = "",
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const adsterraRef = useRef<HTMLDivElement>(null);

  // Por defecto se activa 'adsterra' a menos que se defina explícitamente otro proveedor en .env
  const provider: AdProvider =
    (import.meta.env.VITE_AD_PROVIDER as AdProvider) || "adsterra";

  const pubId = import.meta.env.VITE_ADSENSE_PUB_ID;
  const monetagScriptUrl = import.meta.env.VITE_MONETAG_SCRIPT_URL;
  const ethicalPublisher = import.meta.env.VITE_ETHICALADS_PUBLISHER;

  // Determinar tamaño de Adsterra (300x250 para rectángulos o 320x50 por defecto)
  const isRectangle = adsterraSize === "300x250" || format === "rectangle";
  const width = isRectangle ? 300 : 320;
  const height = isRectangle ? 250 : 50;

  // Claves creadas para Adsterra
  const defaultKey = isRectangle
    ? "58d6a373a56f38ea21da3c86d22f0a4b" // Adsterra 300x250
    : "bcfc3c7bf46c74a9ce7721be94114321"; // Adsterra 320x50

  const activeAdsterraKey =
    adsterraKey ||
    (isRectangle ? import.meta.env.VITE_ADSTERRA_KEY_300X250 : import.meta.env.VITE_ADSTERRA_KEY_320X50) ||
    import.meta.env.VITE_ADSTERRA_KEY ||
    defaultKey;

  useEffect(() => {
    // 1. Adsterra Script Mount
    if (provider === "adsterra" && adsterraRef.current) {
      adsterraRef.current.innerHTML = "";

      // Inyectar atOptions tanto en el scope global como en el contenedor
      const options = {
        key: activeAdsterraKey,
        format: "iframe",
        height: height,
        width: width,
        params: {},
      };

      // @ts-expect-error Adsterra global options
      window.atOptions = options;

      const confScript = document.createElement("script");
      confScript.type = "text/javascript";
      confScript.text = `atOptions = ${JSON.stringify(options)};`;

      const invokeScript = document.createElement("script");
      invokeScript.type = "text/javascript";
      invokeScript.src = `https://www.highperformanceformat.com/${activeAdsterraKey}/invoke.js`;

      adsterraRef.current.appendChild(confScript);
      adsterraRef.current.appendChild(invokeScript);
    }

    // 2. Google AdSense Injection
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

    // 3. Monetag Script Injection (Funciona en Vercel)
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

    // 4. EthicalAds Script Injection
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
  }, [provider, pubId, monetagScriptUrl, activeAdsterraKey, width, height]);

  // Si está en "none", devuelve null (0 píxeles consumidos)
  if (provider === "none") {
    return null;
  }

  // A. Adsterra (Banners limpios 320x50 y 300x250)
  if (provider === "adsterra") {
    return (
      <div className={`ad-banner-wrapper ${className}`}>
        <div
          ref={adsterraRef}
          style={{ width, height, margin: "0 auto", overflow: "hidden" }}
        />
      </div>
    );
  }

  // B. Google AdSense (Dominio Propio)
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

  // C. Monetag / Redes Alternativas (Funciona en .vercel.app)
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

  // D. EthicalAds (Anuncios Tech/Logística)
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

  // E. Banner Propio / Patrocinador Local (Personalizable hoy)
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
