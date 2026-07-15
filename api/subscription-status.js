const jwt = require('./_jwt');

export default function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(200).json({ isSubscribed: false, tier: 'free' });
  }

  const token = authHeader.split(' ')[1];
  const payload = jwt.verify(token);

  if (!payload) {
    return res.status(200).json({ isSubscribed: false, tier: 'free', error: 'Token inválido.' });
  }

  return res.status(200).json({
    isSubscribed: payload.tier === 'pro',
    tier: payload.tier,
    email: payload.email
  });
}
