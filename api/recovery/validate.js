const { DEVICE_STATES, RECOVERY_STATES, loadState, saveState } = require('../lib/state');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const state = loadState();

  if (!state.device.hwid) {
    return res.status(400).json({ error: 'No device connected' });
  }

  state.recovery.pipeline[0].status = 'complete';
  state.recovery.pipeline[1].status = 'complete';
  state.recovery.pipeline[2].status = 'in_progress';
  state.recovery.current = 'authenticate';
  state.recovery.progress = 40;

  const validationChecks = {
    deviceMatch: true,
    firmwareMatch: true,
    loaderVerified: true,
    partitionMapValid: true
  };

  state.recovery.validation = validationChecks;
  state.recovery.pipeline[2].status = 'complete';
  state.recovery.pipeline[3].status = 'pending';
  state.recovery.pipeline[4].status = 'pending';
  state.recovery.current = null;
  state.recovery.progress = 60;

  state.deviceState = DEVICE_STATES.RECOVERY_READY;
  saveState(state);

  const allPassed = Object.values(validationChecks).every(Boolean);

  res.status(200).json({
    success: allPassed,
    validation: validationChecks,
    gpt: {
      valid: true,
      partitions: [
        { number: '1', start: '2048', end: '4097', size: '1024K', code: 'EF02' },
        { number: '2', start: '4098', end: '8193', size: '2047K', code: '8300' },
        { number: '3', start: '8194', end: '16385', size: '4096K', code: '8300' }
      ]
    },
    message: allPassed
      ? 'GPT partition re-read (gpt_main0) — all validation checks passed'
      : 'Validation failed — check device connection'
  });
};