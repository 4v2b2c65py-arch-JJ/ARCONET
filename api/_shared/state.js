const crypto = require('crypto');

const RECOVERY_STATES = ['detect', 'identify', 'authenticate', 'flash', 'verify'];
const DEVICE_STATES = {
  NOT_CONNECTED: { id: 'not_connected', label: 'Not Connected', icon: 'disconnected' },
  EDL_DETECTED: { id: 'edl_detected', label: 'EDL Mode', icon: 'usb' },
  RECOVERY_READY: { id: 'recovery_ready', label: 'Recovery Ready', icon: 'ready' },
  FLASHING: { id: 'flashing', label: 'Flashing', icon: 'flash' },
  RECOVERED: { id: 'recovered', label: 'Recovered', icon: 'success' },
  ERROR: { id: 'error', label: 'Error', icon: 'error' }
};

let currentDeviceStatus = {
  id: crypto.randomUUID(),
  state: DEVICE_STATES.NOT_CONNECTED,
  usb: {
    port: null,
    vid: null,
    pid: null,
    interface: null
  },
  device: {
    hwid: null,
    serial: null,
    model: null,
    partitionSize: null
  },
  sahara: {
    version: null,
    mode: null
  },
  lastSeen: null
};

let recoveryState = {
  pipeline: RECOVERY_STATES.map((state, idx) => ({ id: state, index: idx, status: 'pending' })),
  current: null,
  validation: {
    deviceMatch: false,
    firmwareMatch: false,
    loaderVerified: false,
    partitionMapValid: false
  },
  progress: 0,
    active: false
};

module.exports = { crypto, RECOVERY_STATES, DEVICE_STATES, currentDeviceStatus, recoveryState };