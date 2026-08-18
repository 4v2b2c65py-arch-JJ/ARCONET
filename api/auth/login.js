const { hashPassword, generateToken, loadState, saveState, findSession } = require('../_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { email, password } = data;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const state = loadState();
    const account = state.accounts.find(a => a.email === email);

    if (!account) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordHash = hashPassword(password);
    if (account.passwordHash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const session = {
      token: generateToken(),
      userId: account.id,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    state.sessions.push(session);
    saveState(state);

    const userDevices = state.devices.filter(d => d.userId === account.id);

    res.status(200).json({
      token: session.token,
      user: {
        id: account.id,
        email: account.email,
        name: account.name,
        deviceLimit: account.deviceLimit,
        deviceCount: userDevices.length
      }
    });
  });
};