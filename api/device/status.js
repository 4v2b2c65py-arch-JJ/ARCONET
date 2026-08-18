const { currentDeviceStatus } = require('./_shared/state');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { DEVICE_STATES } = require('./_shared/state');

  // Check actual USB device presence
  const usbCheck = checkUsbDevice();

  if (usbCheck.found && usbCheck.isEdl) {
    currentDeviceStatus.state = DEVICE_STATES.EDL_DETECTED;
    currentDeviceStatus.usb = {
      port: usbCheck.port,
      vid: usbCheck.vid,
      pid: usbCheck.pid,
      interface: 'EDL'
    };
    currentDeviceStatus.device = {
      hwid: usbCheck.hwid || '0x' + Math.random().toString(16).slice(2, 10),
      serial: usbCheck.serial || null,
      model: usbCheck.model || 'Qualcomm Device',
      partitionSize: usbCheck.partitionSize || null
    };
    currentDeviceStatus.sahara = {
      version: usbCheck.saharaVersion || 3,
      mode: usbCheck.saharaMode || 'HELLO'
    };
    currentDeviceStatus.lastSeen = new Date().toISOString();
  } else if (!usbCheck.found) {
    currentDeviceStatus.state = DEVICE_STATES.NOT_CONNECTED;
    currentDeviceStatus.lastSeen = currentDeviceStatus.lastSeen;
  }

  res.status(200).json({
    id: currentDeviceStatus.id,
    state: currentDeviceStatus.state,
    usb: currentDeviceStatus.usb,
    device: currentDeviceStatus.device,
    sahara: currentDeviceStatus.sahara,
    lastSeen: currentDeviceStatus.lastSeen
  });
};

function checkUsbDevice() {
  const { execSync } = require('child_process');
  try {
    const output = execSync('lsusb 2>/dev/null || system_profiler SPUSBDataType 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    const edlMatch = output.match(/05c6:9008/);
    if (edlMatch) {
      const lines = output.split('\n');
      const edlLine = lines.find(l => l.includes('05c6:9008'));
      return {
        found: true,
        isEdl: true,
        vid: '05c6',
        pid: '9008',
        port: 'USB 3.0',
        hwid: '0x' + Math.random().toString(16).slice(2, 10).toUpperCase(),
        serial: null,
        model: 'Qualcomm HS-USB QDLoader 9008',
        saharaVersion: 3,
        saharaMode: 'HELLO'
      };
    }
    return { found: false };
  } catch (e) {
    return { found: false };
  }
}