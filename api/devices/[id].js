const { loadState, saveState, findSession } = require('../_shared/state');

module.exports = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = findSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const state = loadState();
  const deviceIndex = state.devices.findIndex(d => d.id === req.query.id && d.userId === session.userId);
  const device = state.devices.find(d => d.id === req.query.id);

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  if (device.userId !== session.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ device });
  }

  if (req.method === 'PUT') {
    const idx = state.devices.findIndex(d => d.id === device.id);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      state.devices[idx] = { ...state.devices[idx], ...data, id: device.id, userId: session.userId };
      saveState(state);

      res.status(200).json({ success: true, device: state.devices[idx] });
    });
    return;
  }

  if (req.method === 'DELETE') {
    state.devices = state.devices.filter(d => d.id !== device.id);
    saveState(state);
    return res.status(200).json({ success: true, message: 'Device removed' });
  }

  res.status(405).json({ error: 'Method not allowed.' });
};