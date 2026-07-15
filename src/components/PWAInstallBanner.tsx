import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CloseIcon } from "./icons";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showiOSBanner, setShowiOSBanner] = useState(false);

  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (isStandalone) return;

    // Detectar si es móvil
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

    const dismissed = localStorage.getItem("rutafacil_install_dismissed");
    if (dismissed) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !isStandalone) {
      setShowiOSBanner(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowAndroidBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = (type: "android" | "ios") => {
    localStorage.setItem("rutafacil_install_dismissed", "true");
    if (type === "android") setShowAndroidBanner(false);
    if (type === "ios") setShowiOSBanner(false);
  };

  return (
    <AnimatePresence>
      {showAndroidBanner && (
        <motion.div
          className="install-banner"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          <div className="install-banner-content">
            <span className="install-icon">{isMobile ? "📱" : "💻"}</span>
            <div className="install-text">
              <h4>Instala RutaFácil</h4>
              <p>
                {isMobile
                  ? "Acceso directo en tu pantalla y optimización offline."
                  : "Acceso rápido desde tu escritorio y optimización offline."}
              </p>
            </div>
          </div>
          <div className="install-actions">
            <button className="btn-install-confirm" onClick={handleInstallClick}>
              Instalar
            </button>
            <button className="btn-install-close" onClick={() => handleDismiss("android")} aria-label="Cerrar">
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        </motion.div>
      )}

      {showiOSBanner && (
        <motion.div
          className="install-banner install-banner--ios"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          <div className="install-banner-content">
            <span className="install-icon">🍏</span>
            <div className="install-text">
              <h4>Instala en tu iPhone</h4>
              <p>Toca el icono de compartir en tu navegador y selecciona "Agregar a inicio".</p>
            </div>
          </div>
          <button className="btn-install-close" onClick={() => handleDismiss("ios")} aria-label="Cerrar">
            <CloseIcon width={14} height={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
