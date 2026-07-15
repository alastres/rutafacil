const db = require('./_db');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  // Genera OTP de 6 dígitos
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.saveOtp(email, otp);

  // Simulación: En un entorno de desarrollo devolvemos el código
  const isDev = process.env.NODE_ENV !== 'production';

  return res.status(200).json({
    success: true,
    message: "Código OTP generado correctamente.",
    ...(isDev ? { code: otp } : { code: otp }) // En este sandbox siempre devolvemos el código para testeo fácil
  });
}
