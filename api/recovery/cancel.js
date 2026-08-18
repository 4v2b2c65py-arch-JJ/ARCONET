const { recoveryState } = require('./_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!recoveryState.active) {
    return res.status(200).json({
      cancelled: false,
      message: 'No active recovery to cancel'
    });
  }

  recoveryState.active = false;
  recoveryState.current = null;
  recoveryState.pipeline.forEach(p => {
    if (p.status === 'in_progress') {
      p.status = 'pending';
    }
  });

  res.status(200).json({
    cancelled: true,
    message: 'Recovery process cancelled',
    pipeline: recoveryState.pipeline.map(p => ({ id: p.id, status: p.status }))
  });
};