const { loadState } = require('./_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const state = loadState();

  if (!state.device.hwid) {
    return res.status(404).json({ error: 'No device connected' });
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    battery: {
      level: Math.floor(Math.random() * 15) + 65,
      voltage: (Math.random() * 0.3 + 3.8).toFixed(2) + 'V',
      temperature: Math.floor(Math.random() * 8 + 35) + '°C',
      status: 'charging'
    },
    usb: {
      power: (Math.random() * 5 + 10).toFixed(1) + 'W',
      voltage: '5.0V',
      current: Math.floor(Math.random() * 500 + 1000) + 'mA',
      speed: 'USB 3.0'
    },
    storage: {
      total: '118.0 GB',
      available: '45.2 GB',
      used: '72.8 GB'
    },
    thermal: {
      soc: (Math.random() * 5 + 42).toFixed(1) + '°C',
      battery: Math.floor(Math.random() * 8 + 33) + '°C',
      wifi: Math.floor(Math.random() * 5 + 38) + '°C'
    },
    efs: {
      sync: true,
      backup: true,
      ready: true
    }
  });
};