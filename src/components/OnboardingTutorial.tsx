import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouteStore } from "../state/routeStore";
import { CheckIcon, ArrowRightIcon, CrownIcon, MapIcon, WhatsappIcon } from "./icons";

export function OnboardingTutorial() {
  const hasSeen = useRouteStore((s) => s.hasSeenTutorial);
  const setHasSeen = useRouteStore((s) => s.setHasSeenTutorial);
  const [slide, setSlide] = useState(0);

  if (hasSeen) return null;

  const slides = [
    {
      title: "¡Bienvenido a RutaFácil!",
      desc: "La herramienta definitiva para armar las rutas de reparto y entregas más cortas y ahorrar en gasolina.",
      icon: <MapIcon size={38} className="tour-icon" />,
      bullets: [
        "Optimiza rutas por calles reales automáticamente.",
        "Sigue el trayecto en vivo por GPS.",
        "Compatible con autos, motos, bicicletas y a pie."
      ]
    },
    {
      title: "Importa directo de WhatsApp",
      desc: "Olvídate de ingresar direcciones de una en una. Copia chats completos de clientes con enlaces de Google Maps y pégalos.",
      icon: <WhatsappIcon size={38} className="tour-icon whatsapp-color" />,
      bullets: [
        "Copia el bloque de texto completo de tu WhatsApp.",
        "Pégalo en el cuadro superior de la app.",
        "RutaFácil extraerá las coordenadas y generará las paradas en segundos."
      ]
    },
    {
      title: "Potencia tu ruta con PRO",
      desc: "El plan gratuito está limitado a 8 paradas. Mejora tu día a día con el plan RutaFácil PRO.",
      icon: <CrownIcon size={38} className="tour-icon crown-premium" />,
      bullets: [
        "Paradas ilimitadas para repartos masivos.",
        "Reordenamiento manual por arrastre simple.",
        "Añade un punto de retorno (volver a la base de reparto o a casa)."
      ]
    }
  ];

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide((s) => s + 1);
    } else {
      setHasSeen(true);
    }
  };

  const current = slides[slide];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <span className="onboarding-badge">Guía Vial</span>
          <button className="onboarding-skip" onClick={() => setHasSeen(true)}>Saltar</button>
        </div>

        <div className="onboarding-body">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.22 }}
              className="slide-content"
            >
              <div className="slide-icon-wrap">{current.icon}</div>
              <h2>{current.title}</h2>
              <p className="slide-desc">{current.desc}</p>
              <ul className="slide-bullets">
                {current.bullets.map((b, i) => (
                  <li key={i}>
                    <CheckIcon size={12} className="bullet-check" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="onboarding-footer">
          <div className="slide-dots">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={`dot ${idx === slide ? "is-active" : ""}`}
                onClick={() => setSlide(idx)}
              />
            ))}
          </div>
          <button className="btn btn-tour-next" onClick={handleNext}>
            {slide === slides.length - 1 ? "Empezar" : "Siguiente"}
            <ArrowRightIcon size={14} style={{ marginLeft: "6px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
