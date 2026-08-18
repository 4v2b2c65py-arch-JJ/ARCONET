const { loadState, saveState } = require('../_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const state = loadState();
  const rs = state.recovery;

  if (!rs.active) {
    return res.status(200).json({
      cancelled: false,
      message: 'No active recovery to cancel'
    });
  }

  rs.active = false;
  rs.current = null;
  rs.pipeline.forEach(p => {
    if (p.status === 'in_progress') {
      p.status = 'pending';
    }
  });

  saveState(state);

  res.status(200).json({
    cancelled: true,
    message: 'Recovery process cancelled',
    pipeline: rs.pipeline.map(p => ({ id: p.id, status: p.status }))
  });
};