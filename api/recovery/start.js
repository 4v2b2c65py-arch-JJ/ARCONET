const { DEVICE_STATES, loadState, saveState } = require('./_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const state = loadState();
  const rs = state.recovery;

  const allPassed = Object.values(rs.validation).every(Boolean);

  if (!allPassed) {
    return res.status(400).json({
      error: 'Validation has not passed — cannot start recovery',
      validation: rs.validation
    });
  }

  rs.active = true;
  rs.pipeline[3].status = 'in_progress';
  rs.current = 'flash';
  rs.progress = 70;

  state.deviceState = DEVICE_STATES.FLASHING;
  saveState(state);

  res.status(202).json({
    accepted: true,
    message: 'Recovery started — flashing in progress',
    pipeline: rs.pipeline.map(p => ({ id: p.id, status: p.status })),
    current: rs.current,
    progress: rs.progress,
    device: state.device
  });
};