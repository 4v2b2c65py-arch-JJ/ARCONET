const { loadState, saveState, findSession } = require('../_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = findSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const state = loadState();
  state.sessions = state.sessions.filter(s => s.token !== token);
  saveState(state);

  res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  res.status(200).json({ success: true, message: 'Logged out' });
};