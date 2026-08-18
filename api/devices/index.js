const { loadState, saveState, findSession } = require('../_shared/state');

module.exports = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = findSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const state = loadState();
  const account = state.accounts.find(a => a.id === session.userId);
  const userDevices = state.devices.filter(d => d.userId === session.userId);

  if (req.method === 'GET') {
    return res.status(200).json({
      devices: userDevices,
      count: userDevices.length,
      limit: account.deviceLimit
    });
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      const { name, model, serial, hwid, usbVid, usbPid } = data;

      if (userDevices.length >= account.deviceLimit) {
        return res.status(403).json({
          error: 'Device limit reached',
          limit: account.deviceLimit,
          count: userDevices.length
        });
      }

      if (!serial && !hwid) {
        return res.status(400).json({ error: 'serial or hwid is required' });
      }

      const device = {
        id: crypto.randomUUID(),
        userId: session.userId,
        name: name || 'New Device',
        model: model || 'Qualcomm Device',
        serial: serial || null,
        hwid: hwid || null,
        usb: { vid: usbVid || '05c6', pid: usbPid || '9008' },
        status: 'offline',
        lastSeen: null,
        createdAt: new Date().toISOString(),
        recoveryHistory: []
      };

      state.devices.push(device);
      saveState(state);

      res.status(201).json({ success: true, device });
    });
    return;
  }

  res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
};