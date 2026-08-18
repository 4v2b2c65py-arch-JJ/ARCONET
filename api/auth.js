const { hashPassword, generateToken, loadState, saveState, findSession } = require('../_shared/state');

const AUTH_OPS = ['login', 'register', 'session', 'logout'];

module.exports = (req, res) => {
  const op = req.url.split('?')[1] || '';
  const params = new URLSearchParams(op);
  const operation = params.get('op') || (req.method === 'GET' ? 'session' : 'login');

  if (!AUTH_OPS.includes(operation)) {
    return res.status(400).json({ error: 'Invalid operation. Use ?op=login, register, session, or logout.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.cookie?.split('token=')[1];

  switch (operation) {
    case 'register':
      return handleRegister(req, res);
    case 'login':
      return handleLogin(req, res);
    case 'session':
      return handleSession(req, res, token);
    case 'logout':
      return handleLogout(req, res, token);
  }
};

function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { email, password, name } = data;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const state = loadState();
    if (state.accounts.find(a => a.email === email)) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    const account = {
      id: require('crypto').randomUUID(),
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

    const userDevices = state.devices.filter(d => d.userId === account.id);

    res.setHeader('Set-Cookie', `token=${session.token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${24 * 60 * 60}`);
    res.status(201).json({
      token: session.token,
      user: {
        id: account.id, email: account.email, name: account.name,
        deviceLimit: account.deviceLimit, deviceCount: userDevices.length
      }
    });
  });
}

function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { email, password } = data;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const state = loadState();
    const account = state.accounts.find(a => a.email === email);

    if (!account || account.passwordHash !== hashPassword(password)) {
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

    res.setHeader('Set-Cookie', `token=${session.token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${24 * 60 * 60}`);
    res.status(200).json({
      token: session.token,
      user: {
        id: account.id, email: account.email, name: account.name,
        deviceLimit: account.deviceLimit, deviceCount: userDevices.length
      }
    });
  });
}

function handleSession(req, res, token) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!token) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const session = findSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const state = loadState();
  const account = state.accounts.find(a => a.id === session.userId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const userDevices = state.devices.filter(d => d.userId === account.id);
  const recoveryAttempts = userDevices.reduce((sum, d) => sum + (d.recoveryHistory?.length || 0), 0);
  const activeSessions = state.sessions.filter(s => s.userId === account.id).length;

  res.status(200).json({
    user: {
      id: account.id, email: account.email, name: account.name,
      deviceLimit: account.deviceLimit, deviceCount: userDevices.length
    },
    usage: {
      devices: { used: userDevices.length, limit: account.deviceLimit, percentage: Math.round((userDevices.length / account.deviceLimit) * 100) },
      recoveryAttempts,
      sessions: activeSessions,
      maxSessions: 5
    },
    account: {
      id: account.id, email: account.email, name: account.name, createdAt: account.createdAt
    }
  });
}

function handleLogout(req, res, token) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!token) {
    return res.status(200).json({ cancelled: false, message: 'No active session' });
  }

  const state = loadState();
  state.sessions = state.sessions.filter(s => s.token !== token);
  saveState(state);

  res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  res.status(200).json({ success: true, message: 'Logged out' });
}
