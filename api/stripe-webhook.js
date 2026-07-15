const db = require('./_db');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // En producción real se validaría la firma del webhook con process.env.STRIPE_WEBHOOK_SECRET
  const event = req.body;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'invoice.payment_succeeded': {
        const session = event.data?.object || event.data;
        const email = session?.customer_details?.email || session?.customer_email || session?.email;
        if (email) {
          db.setUserPro(email, true);
          console.log(`Usuario PRO habilitado en DB: ${email}`);
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const subscription = event.data?.object || event.data;
        const email = subscription?.customer_email || subscription?.email;
        if (email) {
          db.setUserPro(email, false);
          console.log(`Usuario PRO degradado (pago fallido/suscripción cancelada): ${email}`);
        }
        break;
      }
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error procesando Stripe Webhook:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
