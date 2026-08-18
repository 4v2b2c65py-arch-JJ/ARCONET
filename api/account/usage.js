const { loadState, findSession } = require('../_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = findSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const state = loadState();
  const account = state.accounts.find(a => a.id === session.userId);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const userDevices = state.devices.filter(d => d.userId === session.userId);

  res.status(200).json({
    account: {
      id: account.id,
      email: account.email,
      name: account.name,
      createdAt: account.createdAt
    },
    usage: {
      devices: {
        used: userDevices.length,
        limit: account.deviceLimit,
        percentage: Math.round((userDevices.length / account.deviceLimit) * 100)
      },
      recoveryAttempts: userDevices.reduce((sum, d) => sum + (d.recoveryHistory?.length || 0), 0),
      sessions: state.sessions.filter(s => s.userId === session.userId).length,
      maxSessions: 5
    }
  });
};