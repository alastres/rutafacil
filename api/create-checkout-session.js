export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { provider, successUrl, cancelUrl } = req.body;
  const isStripe = provider === 'stripe';

  // En producción real aquí inicializaríamos la sesión de Stripe / MercadoPago
  // y devolveríamos la url real de Stripe Checkout o MercadoPago URL.
  const mockUrl = isStripe
    ? `${successUrl}?session_id=mock_success`
    : `${successUrl}?status=approved`;

  return res.status(200).json({
    url: mockUrl,
    sessionId: "mock_session_id_prod_simulated"
  });
}
