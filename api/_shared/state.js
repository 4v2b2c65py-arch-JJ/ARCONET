const crypto = require('crypto');

const DEVICE_STATES = {
  NOT_CONNECTED: { id: 'not_connected', label: '● DEVICE OFFLINE' },
  EDL_DETECTED: { id: 'edl_detected', label: '● DEVICE ONLINE' },
  RECOVERY_READY: { id: 'recovery_ready', label: '● RECOVERY READY' },
  FLASHING: { id: 'flashing', label: '● FLASHING' },
  RECOVERED: { id: 'recovered', label: '● RECOVERED' }
};

const RECOVERY_STATES = ['detect', 'identify', 'authenticate', 'flash', 'verify'];

const STATE_FILE = '/tmp/arconet_state.json';

function loadState() {
  try {
    const fs = require('fs');
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      // Merge with defaults to ensure all required fields exist
      const defaults = getDefaultState();
      return {
        ...defaults,
        ...data,
        accounts: data.accounts || [],
        sessions: data.sessions || [],
        devices: data.devices || []
      };
    }
  } catch (e) {}
  return getDefaultState();
}

function getDefaultState() {
  return {
    deviceId: crypto.randomUUID(),
    accounts: [],
    sessions: [],
    devices: [],
    deviceState: DEVICE_STATES.NOT_CONNECTED,
    usb: { port: null, vid: null, pid: null, interface: null },
    device: { hwid: null, serial: null, model: null, partitionSize: null },
    sahara: { version: null, mode: null },
    lastSeen: null,
    recovery: {
      pipeline: RECOVERY_STATES.map((s, i) => ({ id: s, index: i, status: 'pending' })),
      current: null,
      validation: {
        deviceMatch: false,
        firmwareMatch: false,
        loaderVerified: false,
        partitionMapValid: false
      },
      progress: 0,
      active: false
    }
  };
}

function saveState(state) {
  try {
    const fs = require('fs');
    const dir = '/tmp/arconet_state.json';
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function findSession(token) {
  const state = loadState();
  const session = state.sessions.find(s => s.token === token);
  if (!session) return null;

  const now = Date.now();
  if (now > session.expiresAt) {
    state.sessions = state.sessions.filter(s => s.token !== token);
    saveState(state);
    return null;
  }
  return session;
}

module.exports = {
  crypto, DEVICE_STATES, RECOVERY_STATES,
  loadState, saveState, getDefaultState,
  hashPassword, generateToken, findSession
};