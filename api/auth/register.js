const { hashPassword, generateToken, loadState, saveState } = require('../_shared/state');

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

    const { email, password, name } = data;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const state = loadState();

    const existing = state.accounts.find(a => a.email === email);
    if (existing) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    const account = {
      id: crypto.randomUUID(),
      email,
      name: name || email.split('@')[0],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      deviceLimit: 5
    };

    state.accounts.push(account);

    const session = {
      token: generateToken(),
      userId: account.id,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    state.sessions.push(session);
    saveState(state);

    res.status(201).json({
      token: session.token,
      user: {
        id: account.id,
        email: account.email,
        name: account.name,
        deviceLimit: account.deviceLimit,
        deviceCount: 0
      }
    });
  });
};