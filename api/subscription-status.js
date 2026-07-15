export default function handler(req, res) {
  const { session_id, status } = req.query;

  if (session_id === 'mock_success' || status === 'approved') {
    return res.status(200).json({
      isSubscribed: true,
      tier: 'pro',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
  }

  return res.status(200).json({
    isSubscribed: false,
    tier: 'free'
  });
}
