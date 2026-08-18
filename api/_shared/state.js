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
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}

  return {
    deviceId: crypto.randomUUID(),
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
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

module.exports = { crypto, DEVICE_STATES, RECOVERY_STATES, loadState, saveState };