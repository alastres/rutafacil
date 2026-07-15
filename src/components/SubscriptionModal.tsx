import { useRouteStore } from "../state/routeStore";
import { startCheckout } from "../services/paymentService";
import { CloseIcon, CrownIcon, LockIcon } from "./icons";
import { useState } from "react";

export function SubscriptionModal() {
  const isOpen = useRouteStore((s) => s.isSubscriptionModalOpen);
  const setOpen = useRouteStore((s) => s.setSubscriptionModalOpen);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = async (provider: 'stripe' | 'mercadopago') => {
    setLoading(true);
    await startCheckout(provider);
    setLoading(false);
  };

  return (
    <div
      className="history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Suscripción Premium"
      onClick={(e) => e.target === e.currentTarget && !loading && setOpen(false)}
      style={{ zIndex: 100 }}
    >
      <div className="history-panel subscription-modal-panel">
        <div className="history-panel__header subscription-modal-header">
          <div className="subscription-title-wrap">
            <CrownIcon size={18} className="crown-premium" />
            <h2>RUTA FÁCIL PRO</h2>
          </div>
          <button
            className="history-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar modal"
            disabled={loading}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="subscription-modal-body">
          <div className="persuasion-card">
            <h3>🏁 Ahorra hasta 30% en gasolina</h3>
            <p>
              Optimiza tus entregas sin límites y toma el control absoluto de tus rutas diarias. ¡Menos tiempo al volante equivale a más dinero en tu bolsillo!
            </p>
          </div>

          <table className="comparison-table">
            <thead>
              <tr>
                <th>Característica</th>
                <th>Gratuito</th>
                <th className="pro-header">PRO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Límite de Paradas</td>
                <td>Hasta 8</td>
                <td className="pro-cell font-bold">Ilimitadas</td>
              </tr>
              <tr>
                <td>Cálculo de Ruta Óptima</td>
                <td>✅</td>
                <td className="pro-cell">✅</td>
              </tr>
              <tr>
                <td>Reordenamiento Manual</td>
                <td>❌ <LockIcon size={10} /></td>
                <td className="pro-cell">✅ Arrastrar</td>
              </tr>
              <tr>
                <td>Punto de Retorno</td>
                <td>❌ <LockIcon size={10} /></td>
                <td className="pro-cell">✅ Personalizado</td>
              </tr>
            </tbody>
          </table>

          <div className="pricing-wrap">
            <div className="price-tag">
              <span className="amount">$4.99 USD</span>
              <span className="period">/ mes</span>
            </div>
            <p className="cancel-anytime">Cancela cuando quieras desde tu perfil.</p>
          </div>

          <div className="checkout-actions">
            <button
              className="btn btn-stripe"
              disabled={loading}
              onClick={() => handleSubscribe('stripe')}
            >
              {loading ? "Redirigiendo..." : "Suscribirse con Stripe"}
            </button>
            <button
              className="btn btn-mercadopago"
              disabled={loading}
              onClick={() => handleSubscribe('mercadopago')}
            >
              {loading ? "Redirigiendo..." : "Suscribirse con MercadoPago"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
