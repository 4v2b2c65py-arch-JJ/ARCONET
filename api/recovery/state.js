const { recoveryState, RECOVERY_STATES } = require('./_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pipelineWithStatus = RECOVERY_STATES.map((stateId, idx) => {
    const pipelineEntry = recoveryState.pipeline[idx];
    return {
      id: stateId,
      name: stateId.charAt(0).toUpperCase() + stateId.slice(1),
      status: pipelineEntry.status,
      index: idx
    };
  });

  res.status(200).json({
    pipeline: pipelineWithStatus,
    current: recoveryState.current,
    validation: recoveryState.validation,
    progress: recoveryState.progress,
    active: recoveryState.active,
    canStart: recoveryState.validation.deviceMatch &&
              recoveryState.validation.firmwareMatch &&
              recoveryState.validation.loaderVerified &&
              recoveryState.validation.partitionMapValid
  });
};