const db = require('./_db');
const jwt = require('./_jwt');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Datos incompletos.' });
  }

  const isValid = db.verifyOtp(email, otp);
  if (!isValid) {
    return res.status(400).json({ error: 'Código incorrecto o expirado.' });
  }

  // Verificar estado de suscripción
  let user = db.getUser(email);
  if (!user) {
    // Si no existe en la DB mock de Stripe, se registra como Free por defecto
    user = { email: email.toLowerCase(), tier: 'free', active: false };
  }

  // Emitimos un token JWT firmado criptográficamente válido por 30 días
  const tokenPayload = {
    email: user.email,
    tier: user.tier,
    exp: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
  };
  
  const token = jwt.sign(tokenPayload);

  return res.status(200).json({
    success: true,
    token,
    tier: user.tier
  });
}
