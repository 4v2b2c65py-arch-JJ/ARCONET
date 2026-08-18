const { recoveryState, currentDeviceStatus, DEVICE_STATES } = require('./_shared/state');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allChecksPassed = Object.values(recoveryState.validation).every(v => v);
  if (!allChecksPassed) {
    return res.status(400).json({
      error: 'Validation has not passed — cannot start recovery',
      validation: recoveryState.validation
    });
  }

  if (!recoveryState.validation.partitionMapValid) {
    return res.status(400).json({
      error: 'GPT partition map not validated'
    });
  }

  recoveryState.active = true;
  recoveryState.pipeline[3].status = 'in_progress'; // flash
  recoveryState.current = 'flash';
  recoveryState.progress = 70;

  currentDeviceStatus.state = DEVICE_STATES.FLASHING;

  // Simulate flashing process with async progression
  const flashSteps = [
    { step: 'programmer_load', progress: 10, message: 'Loading firehose programmer...' },
    { step: 'memory_init', progress: 25, message: 'Initializing memory interface...' },
    { step: 'partition_erase', progress: 50, message: 'Erasing partitions...' },
    { step: 'firmware_write', progress: 80, message: 'Writing firmware image...' },
    { step: 'verify_write', progress: 95, message: 'Verifying written data...' }
  ];

  let lastStep = { step: 'complete', progress: 100, message: 'Recovery successful' };

  // In production, this would execute the actual recovery script
  // For the API, we simulate the process and return immediate status
  setTimeout(() => {
    recoveryState.pipeline[3].status = 'complete'; // flash
    recoveryState.pipeline[4].status = 'complete'; // verify
    recoveryState.current = null;
    recoveryState.progress = 100;
    recoveryState.active = false;
    currentDeviceStatus.state = DEVICE_STATES.RECOVERED;
    lastStep = { step: 'complete', progress: 100, message: 'Device recovered successfully' };
  }, 10000);

  res.status(202).json({
    accepted: true,
    message: 'Recovery started — flashing in progress',
    pipeline: recoveryState.pipeline.map(p => ({ id: p.id, status: p.status })),
    current: recoveryState.current,
    progress: recoveryState.progress,
    device: currentDeviceStatus.device
  });
};