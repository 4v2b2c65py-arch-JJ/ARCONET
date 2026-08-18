const { RECOVERY_STATES, loadState, saveState } = require('../_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const state = loadState();
  const rs = state.recovery;

  const pipelineWithStatus = RECOVERY_STATES.map((stateId, idx) => ({
    id: stateId,
    name: stateId.charAt(0).toUpperCase() + stateId.slice(1),
    status: rs.pipeline[idx].status,
    index: idx
  }));

  const allPassed = Object.values(rs.validation).every(Boolean);

  res.status(200).json({
    pipeline: pipelineWithStatus,
    current: rs.current,
    validation: rs.validation,
    progress: rs.progress,
    active: rs.active,
    canStart: allPassed
  });
};