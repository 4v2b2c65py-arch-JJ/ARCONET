const { hashPassword, generateToken, loadState, saveState, findSession } = require('./lib/state');

const AUTH_OPS = ['login', 'register', 'session', 'logout', 'devices', 'device-add', 'device-detail', 'device-delete'];

module.exports = (req, res) => {
  const urlParts = req.url.split('?');
  const queryStr = urlParts[1] || '';
  const params = new URLSearchParams(queryStr);
  let operation = params.get('op');

  if (!operation) {
    if (urlParts[0].includes('/devices')) operation = 'devices';
    else if (req.method === 'GET') operation = 'session';
    else operation = 'login';
  }

  if (!AUTH_OPS.includes(operation)) {
    return res.status(400).json({ error: 'Invalid operation. Use ?op=login, register, session, logout, devices, or device-add.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.cookie?.split('token=')[1];

  switch (operation) {
    case 'register': return handleRegister(req, res);
    case 'login': return handleLogin(req, res);
    case 'session': return handleSession(req, res, token);
    case 'logout': return handleLogout(req, res, token);
    case 'devices': return handleDevicesList(req, res, token);
    case 'device-add': return handleDeviceAdd(req, res, token);
    case 'device-detail': return handleDeviceDetail(req, res, token, params.get('id'));
    case 'device-delete': return handleDeviceDelete(req, res, token, params.get('id'));
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

function authMiddleware(token) {
  if (!token) return { error: 'No session token provided' };
  const session = findSession(token);
  if (!session) return { error: 'Invalid or expired session' };
  const state = loadState();
  const account = state.accounts.find(a => a.id === session.userId);
  if (!account) return { error: 'Account not found' };
  return { session, account, state };
}

function handleDevicesList(req, res, token) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const userDevices = auth.state.devices.filter(d => d.userId === auth.account.id);
  res.status(200).json({ devices: userDevices, count: userDevices.length, limit: auth.account.deviceLimit });
}

function handleDeviceAdd(req, res, token) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const userDevices = auth.state.devices.filter(d => d.userId === auth.account.id);
  if (userDevices.length >= auth.account.deviceLimit) {
    return res.status(403).json({ error: 'Device limit reached', limit: auth.account.deviceLimit, count: userDevices.length });
  }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
    const { name, model, serial, hwid, usbVid, usbPid } = data;
    if (!serial && !hwid) return res.status(400).json({ error: 'serial or hwid is required' });
    const device = {
      id: require('crypto').randomUUID(),
      userId: auth.account.id,
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
    auth.state.devices.push(device);
    saveState(auth.state);
    res.status(201).json({ success: true, device });
  });
}

function handleDeviceDetail(req, res, token, id) {
  if (!id) return res.status(400).json({ error: 'Device ID required' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const device = auth.state.devices.find(d => d.id === id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  if (device.userId !== auth.account.id) return res.status(403).json({ error: 'Access denied' });
  res.status(200).json({ device });
}

function handleDeviceDelete(req, res, token, id) {
  if (!id) return res.status(400).json({ error: 'Device ID required' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const idx = auth.state.devices.findIndex(d => d.id === id && d.userId === auth.account.id);
  if (idx === -1) return res.status(404).json({ error: 'Device not found' });
  auth.state.devices.splice(idx, 1);
  saveState(auth.state);
  res.status(200).json({ success: true, message: 'Device removed' });
}
