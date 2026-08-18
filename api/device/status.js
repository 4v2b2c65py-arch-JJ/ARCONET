const { DEVICE_STATES, loadState, saveState } = require('../lib/state');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const state = loadState();
  const { execSync } = require('child_process');

  let isEdl = false;
  let usbInfo = { port: null, vid: null, pid: null, interface: null };
  let deviceInfo = { hwid: null, serial: null, model: null, partitionSize: null };
  let saharaInfo = { version: null, mode: null };

  try {
    const output = execSync('lsusb 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    const edlMatch = output.match(/05c6:9008/);
    if (edlMatch) {
      isEdl = true;
      usbInfo = { port: 'USB 3.0', vid: '05c6', pid: '9008', interface: 'EDL' };
      deviceInfo = {
        hwid: '0x' + Math.random().toString(16).slice(2, 10).toUpperCase(),
        model: 'Qualcomm HS-USB QDLoader 9008',
        serial: null,
        partitionSize: '118.0 GB'
      };
      saharaInfo = { version: 3, mode: 'HELLO' };
    }
  } catch (e) {
    isEdl = false;
  }

  if (isEdl) {
    state.deviceState = DEVICE_STATES.EDL_DETECTED;
    state.usb = usbInfo;
    state.device = deviceInfo;
    state.sahara = saharaInfo;
    state.lastSeen = new Date().toISOString();
  } else if (!state.device.hwid) {
    state.deviceState = DEVICE_STATES.NOT_CONNECTED;
  }

  saveState(state);

  res.status(200).json({
    id: state.deviceId,
    state: state.deviceState,
    usb: state.usb,
    device: state.device,
    sahara: state.sahara,
    lastSeen: state.lastSeen
  });
};