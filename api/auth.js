const { hashPassword, generateToken, loadState, saveState, findSession, crypto } = require('./_shared/state');

const AUTH_OPS = ['login', 'register', 'session', 'logout', 'devices', 'device-add', 'device-detail', 'device-delete', 'training-state', 'training-start', 'training-step', 'training-stop'];

let trainer = null;

function getTrainer() {
  if (!trainer) {
    trainer = new SimpleTrainer();
    const state = loadState();
    if (state.training) trainer.loadState(state.training);
  }
  return trainer;
}

class SimpleNeuralNet {
  constructor(inputSize = 16, hiddenSize = 8, outputSize = 8) {
    this.weightsIH = Array.from({ length: inputSize }, () =>
      Array.from({ length: hiddenSize }, () => (Math.random() * 2 - 1) * 0.5));
    this.biasH = Array.from({ length: hiddenSize }, () => (Math.random() * 2 - 1) * 0.5);
    this.weightsHO = Array.from({ length: hiddenSize }, () =>
      Array.from({ length: outputSize }, () => (Math.random() * 2 - 1) * 0.5));
    this.biasO = Array.from({ length: outputSize }, () => (Math.random() * 2 - 1) * 0.5);
    this.learningRate = 0.01;
  }

  static sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
  static dsigmoid(y) { return y * (1 - y); }

  forward(input) {
    const hidden = this.weightsIH[0].map((_, j) =>
      this.biasH[j] + input.reduce((sum, val, i) => sum + val * this.weightsIH[i][j], 0)
    ).map(v => SimpleNeuralNet.sigmoid(v));
    const output = this.weightsHO[0].map((_, j) =>
      this.biasO[j] + hidden.reduce((sum, val, i) => sum + val * this.weightsHO[i][j], 0)
    ).map(v => SimpleNeuralNet.sigmoid(v));
    return { hidden, output };
  }

  train(input, target) {
    const { hidden, output } = this.forward(input);
    const errors = target.map((t, i) => t - output[i]);
    const outDelta = errors.map((e, i) => e * SimpleNeuralNet.dsigmoid(output[i]));

    for (let i = 0; i < hidden.length; i++) {
      for (let j = 0; j < output.length; j++) {
        this.weightsHO[i][j] += this.learningRate * outDelta[j] * hidden[i];
      }
    }
    for (let j = 0; j < output.length; j++) {
      this.biasO[j] += this.learningRate * outDelta[j];
    }

    const hiddenErrors = hidden.map((h, i) =>
      outDelta.reduce((sum, delta, j) => sum + delta * this.weightsHO[i][j], 0));
    const hiddenDelta = hiddenErrors.map((e, i) => e * SimpleNeuralNet.dsigmoid(hidden[i]));

    for (let i = 0; i < input.length; i++) {
      for (let j = 0; j < hidden.length; j++) {
        this.weightsIH[i][j] += this.learningRate * hiddenDelta[j] * input[i];
      }
    }
    for (let j = 0; j < hidden.length; j++) {
      this.biasH[j] += this.learningRate * hiddenDelta[j];
    }

    return { loss: errors.reduce((s, e) => s + e * e, 0) / target.length, output };
  }

  serialize() {
    return {
      weightsIH: this.weightsIH, biasH: this.biasH,
      weightsHO: this.weightsHO, biasO: this.biasO,
      learningRate: this.learningRate
    };
  }

  static deserialize(data) {
    const net = new SimpleNeuralNet();
    net.weightsIH = data.weightsIH; net.biasH = data.biasH;
    net.weightsHO = data.weightsHO; net.biasO = data.biasO;
    net.learningRate = data.learningRate;
    return net;
  }
}

class SimpleTrainer {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.currentStep = 0;
    this.totalSteps = 1000;
    this.lossHistory = [];
    this.accuracyHistory = [];
    this.lastLoss = null;
    this.targetLoss = 0.001;
    this.converged = false;
    this.startedAt = null;
  }

  generateTemplate() {
    const templates = [
      '<div>{{greeting}}, {{name}}!</div>',
      '<div class="{{status}}">{{message}}</div>',
      '<h1>{{title}}</h1><p>{{content}}</p>',
      '<span class="badge {{type}}">{{count}}</span>',
      '<div data-id="{{id}}" data-status="{{state}}">{{label}}</div>',
      '<ul>{{#each items as |item|}}<li>{{item}}</li>{{/each}}</ul>',
      '<div>{{#if isActive}}Active{{else}}Inactive{{/if}}</div>',
      '<a href="{{url}}">{{text}}</a>'
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateContext() {
    const contexts = [
      { greeting: 'Hello', name: 'World', status: 'online', message: 'All systems operational' },
      { title: 'System', content: 'Recovery', status: 'warning' },
      { type: 'badge', count: 42, status: 'active' },
      { id: 'DEV-001', state: 'ready', label: 'Ready' },
      { items: ['A', 'B'], status: 'list' },
      { isActive: true, status: 'power' },
      { url: '/dashboard', text: 'Go' }
    ];
    return contexts[Math.floor(Math.random() * contexts.length)];
  }

  getContextVector(context) {
    const keys = ['greeting','name','status','message','title','content',
                  'type','count','id','state','label','url','text','isActive'];
    const vector = keys.map(k => {
      const val = context[k];
      if (typeof val === 'string') return val.split('').reduce((a,c) => a + c.charCodeAt(0), 0) / 1000;
      if (typeof val === 'number') return val / 100;
      if (typeof val === 'boolean') return val ? 1 : 0;
      return 0;
    });
    while (vector.length < 16) vector.push(0);
    return vector.slice(0, 16);
  }

  getTargetVector(context, template) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(template).digest('hex');
    const target = Array.from(hash.slice(0, 8)).map(c => parseInt(c, 16) / 15);
    while (target.length < 8) target.push(0);
    return target;
  }

  initialize() {
    if (!this.model) this.model = new SimpleNeuralNet();
    this.currentStep = 0;
    this.lossHistory = [];
    this.accuracyHistory = [];
    this.isTraining = false;
    this.lastLoss = null;
    this.converged = false;
  }

  step() {
    if (!this.model) this.initialize();
    const template = this.generateTemplate();
    const context = this.generateContext();
    const target = this.getTargetVector(context, template);
    const input = this.getContextVector(context);
    const result = this.model.train(input, target);

    this.currentStep++;
    this.lossHistory.push(result.loss);
    this.lastLoss = result.loss;
    this.accuracyHistory.push(
      target.reduce((sum, t, i) => sum + (Math.abs(t - result.output[i]) < 0.3 ? 1 : 0), 0) / target.length
    );

    return { step: this.currentStep, loss: result.loss, accuracy: this.accuracyHistory[this.accuracyHistory.length - 1] };
  }

  autoTrain(steps = 50) {
    if (!this.model) this.initialize();
    for (let i = 0; i < steps; i++) {
      const r = this.step();
      if (this.lastLoss !== null && this.lastLoss < this.targetLoss) {
        this.converged = true;
        this.isTraining = false;
        break;
      }
    }
    const recentLoss = this.lossHistory.slice(-10);
    const avgLoss = recentLoss.reduce((a, b) => a + b, 0) / Math.max(recentLoss.length, 1);
    const recentAcc = this.accuracyHistory.slice(-10);
    const avgAcc = recentAcc.reduce((a, b) => a + b, 0) / Math.max(recentAcc.length, 1);
    return {
      stepsCompleted: steps,
      currentStep: this.currentStep,
      loss: avgLoss,
      accuracy: avgAcc,
      converged: this.converged
    };
  }

  getState() {
    return {
      isTraining: this.isTraining,
      startedAt: this.startedAt,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      loss: this.lossHistory.length > 0 ? this.lossHistory[this.lossHistory.length - 1] : null,
      accuracy: this.accuracyHistory.length > 0 ? this.accuracyHistory[this.accuracyHistory.length - 1] : 0,
      converged: this.converged,
      weights: this.model ? this.model.serialize() : null,
      lossHistory: this.lossHistory.slice(-50),
      accuracyHistory: this.accuracyHistory.slice(-50),
      glimmerAvailable: false
    };
  }

  loadState(state) {
    if (state.weights && !this.model) this.model = SimpleNeuralNet.deserialize(state.weights);
    else if (state.weights && this.model) {
      this.model.weightsIH = state.weights.weightsIH;
      this.model.biasH = state.weights.biasH;
      this.model.weightsHO = state.weights.weightsHO;
      this.model.biasO = state.weights.biasO;
      this.model.learningRate = state.weights.learningRate;
    }
    this.currentStep = state.currentStep || 0;
    this.lossHistory = state.lossHistory || [];
    this.accuracyHistory = state.accuracyHistory || [];
    this.isTraining = state.isTraining || false;
    this.converged = state.converged || false;
    this.lastLoss = state.loss || null;
    this.startedAt = state.startedAt || null;
  }

  saveState(state) {
    state.training = {
      isTraining: this.isTraining,
      startedAt: this.startedAt,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      loss: this.lossHistory.length > 0 ? this.lossHistory[this.lossHistory.length - 1] : null,
      accuracy: this.accuracyHistory.length > 0 ? this.accuracyHistory[this.accuracyHistory.length - 1] : 0,
      converged: this.converged,
      weights: this.model ? this.model.serialize() : null,
      lossHistory: this.lossHistory.slice(-50),
      accuracyHistory: this.accuracyHistory.slice(-50)
    };
    saveState(state);
  }
}

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
    case 'training-state': return handleTrainingState(req, res, token);
    case 'training-start': return handleTrainingStart(req, res, token);
    case 'training-step': return handleTrainingStep(req, res, token);
    case 'training-stop': return handleTrainingStop(req, res, token);
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

function handleTrainingState(req, res, token) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const t = getTrainer();
  res.status(200).json({ training: t.getState() });
}

function handleTrainingStart(req, res, token) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const t = getTrainer();
  t.isTraining = true;
  t.startedAt = t.startedAt || new Date().toISOString();
  t.totalSteps = 1000;
  t.saveState(auth.state);
  res.status(200).json({ started: true, message: 'Auto-training started', totalSteps: t.totalSteps });
}

function handleTrainingStep(req, res, token) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const t = getTrainer();
  let steps = 50;
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}');
      steps = data.steps || 50;
    } catch (e) {}
    const result = t.autoTrain(steps);
    t.saveState(auth.state);
    res.status(200).json({
      ...result,
      currentStep: t.currentStep,
      isTraining: t.isTraining
    });
  });
}

function handleTrainingStop(req, res, token) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  const auth = authMiddleware(token);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const t = getTrainer();
  t.isTraining = false;
  const state = loadState();
  t.saveState(state);
  res.status(200).json({ stopped: true, message: 'Training stopped', currentStep: t.currentStep });
}
