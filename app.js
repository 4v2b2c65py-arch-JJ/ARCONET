const ARCONET_TOKEN = window.ARCONET_TOKEN || localStorage.getItem('arconet_token') || '';

class ARCONET {
  constructor() {
    this.apiBase = '/api';
    this.token = ARCONET_TOKEN;
    this.headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
    this.deviceStatus = null;
    this.recoveryState = null;
    this.telemetry = null;
    this.logEntries = [];
    this.refreshInterval = null;

    this.elements = {
      deviceStatusBadge: document.getElementById('deviceStatusBadge'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      deviceModel: document.getElementById('deviceModel'),
      deviceHwid: document.getElementById('deviceHwid'),
      usbStatus: document.getElementById('usbStatus'),
      protocolStatus: document.getElementById('protocolStatus'),
      deviceIdValue: document.getElementById('deviceIdValue'),
      batteryValue: document.getElementById('batteryValue'),
      usbPowerValue: document.getElementById('usbPowerValue'),
      tempValue: document.getElementById('tempValue'),
      storageValue: document.getElementById('storageValue'),
      socValue: document.getElementById('socValue'),
      batteryTempValue: document.getElementById('batteryTempValue'),
      wifiValue: document.getElementById('wifiValue'),
      progressBar: document.getElementById('progressBar'),
      progressFill: document.getElementById('progressFill'),
      progressPercent: document.getElementById('progressPercent'),
      progressStatus: document.getElementById('progressStatus'),
      validateBtn: document.getElementById('validateBtn'),
      startRecoveryBtn: document.getElementById('startRecoveryBtn'),
      expandDiagnostics: document.getElementById('expandDiagnostics'),
      diagnosticsBody: document.getElementById('diagnosticsBody'),
      logContainer: document.getElementById('logContainer'),
      checkDevice: document.getElementById('checkDevice'),
      checkFirmware: document.getElementById('checkFirmware'),
      checkLoader: document.getElementById('checkLoader'),
      checkPartition: document.getElementById('checkPartition'),
      orbitLabels: document.querySelectorAll('.orbit-label')
    };

    this.init();
  }

  async init() {
    this.log('ARCONET initialized — waiting for device...');
    this.setupEventListeners();
    await this.refreshAll();
    this.refreshInterval = setInterval(() => this.refreshAll(), 3000);
  }

  setupEventListeners() {
    this.elements.validateBtn.addEventListener('click', () => this.validate());
    this.elements.startRecoveryBtn.addEventListener('click', () => this.startRecovery());
    this.elements.expandDiagnostics.addEventListener('click', () => this.toggleDiagnostics());
  }

  async refreshAll() {
    await Promise.allSettled([
      this.refreshDeviceStatus(),
      this.refreshRecoveryState()
    ]);
    if (this.deviceStatus && this.deviceStatus.device?.hwid) {
      try {
        this.telemetry = await this.fetch('/api/device/telemetry', { method: 'GET' });
        this.updateTelemetry();
      } catch (e) {
        this.log('Telemetry fetch failed: ' + e.message);
      }
    }
  }

  async refreshDeviceStatus() {
    try {
      const data = await this.fetch('/api/device/status', { method: 'GET' });
      this.deviceStatus = data;
      this.updateDeviceStatus();
    } catch (e) {
      this.log('Device status check failed: ' + e.message);
    }
  }

  async refreshRecoveryState() {
    try {
      const data = await this.fetch('/api/recovery/state', { method: 'GET' });
      this.recoveryState = data;
      this.updateRecoveryState();
    } catch (e) {
      this.log('Recovery state fetch failed: ' + e.message);
    }
  }

  updateDeviceStatus() {
    const ds = this.deviceStatus;
    const state = ds?.state;
    if (state) {
      this.elements.statusDot.className = 'status-dot ' + (state.id === 'not_connected' ? 'offline' : 'online');
      this.elements.statusText.textContent = state.label;
      this.elements.statusText.style.color = state.id === 'not_connected' ? 'var(--text-secondary)' : 'var(--success)';
      if (ds.device) {
        this.elements.deviceModel.textContent = ds.device.model || 'No Device Connected';
        this.elements.deviceHwid.textContent = ds.device.hwid || '—';
        this.elements.deviceIdValue.textContent = ds.device.serial || ds.device.hwid || '—';
      }
      this.elements.usbStatus.textContent = state.id === 'not_connected' ? 'Not connected' : 'Connected';
      this.elements.usbStatus.className = 'value ' + (state.id === 'not_connected' ? '' : 'connected');
      this.elements.protocolStatus.textContent = ds.sahara
        ? `Sahara v${ds.sahara.version} (${ds.sahara.mode})`
        : '—';
      this.elements.validateBtn.disabled = state.id === 'not_connected' || state.id === 'recovered';
      this.elements.startRecoveryBtn.disabled = true;
    }
  }

  updateRecoveryState() {
    const rs = this.recoveryState;
    if (!rs) return;
    if (rs.pipeline) {
      rs.pipeline.forEach((step, idx) => {
        const label = this.elements.orbitLabels[idx];
        if (label) {
          label.className = 'orbit-label';
          if (step.status === 'complete') label.classList.add('completed');
          if (step.status === 'in_progress') label.classList.add('active');
        }
      });
    }
    if (rs.progress !== undefined) {
      this.elements.progressFill.style.width = `${rs.progress}%`;
      this.elements.progressPercent.textContent = `${rs.progress}%`;
    }
    if (rs.current) {
      this.elements.progressStatus.textContent = rs.current.charAt(0).toUpperCase() + rs.current.slice(1);
    } else {
      this.elements.progressStatus.textContent = rs.active ? 'In Progress' : 'Idle';
    }
    if (rs.validation) {
      const v = rs.validation;
      this.setCheckState(this.elements.checkDevice, v.deviceMatch);
      this.setCheckState(this.elements.checkFirmware, v.firmwareMatch);
      this.setCheckState(this.elements.checkLoader, v.loaderVerified);
      this.setCheckState(this.elements.checkPartition, v.partitionMapValid);
      const allPassed = Object.values(v).every(Boolean);
      this.elements.startRecoveryBtn.disabled = !allPassed || !rs.canStart;
      if (rs.active) this.elements.startRecoveryBtn.disabled = true;
    }
  }

  setCheckState(element, passed) {
    if (!element) return;
    const icon = element.querySelector('.check-icon');
    if (icon) icon.textContent = passed ? '✓' : '○';
    element.classList.toggle('passed', passed);
    element.classList.toggle('failed', !passed);
  }

  updateTelemetry() {
    if (!this.telemetry) return;
    if (this.telemetry.battery) {
      this.elements.batteryValue.textContent =
        `${this.telemetry.battery.level}% ${this.telemetry.battery.voltage}`;
    }
    if (this.telemetry.usb) this.elements.usbPowerValue.textContent = this.telemetry.usb.power;
    if (this.telemetry.battery) this.elements.tempValue.textContent = this.telemetry.battery.temperature;
    if (this.telemetry.storage) this.elements.storageValue.textContent = this.telemetry.storage.available;
    if (this.telemetry.thermal) {
      this.elements.socValue.textContent = this.telemetry.thermal.soc;
      this.elements.batteryTempValue.textContent = this.telemetry.thermal.battery;
      this.elements.wifiValue.textContent = this.telemetry.thermal.wifi;
    }
  }

  async validate() {
    this.log('Validate initiated — re-reading gpt_main0...');
    this.elements.validateBtn.disabled = true;
    try {
      const data = await this.fetch('/api/recovery/validate', { method: 'POST' });
      if (data.success) {
        this.log('Validation passed — GPT partition re-read complete');
      } else {
        this.log('Validation failed — check diagnostics');
      }
      await this.refreshRecoveryState();
      await this.refreshDeviceStatus();
    } catch (e) {
      this.log('Validation error: ' + e.message);
    } finally {
      this.elements.validateBtn.disabled = false;
    }
  }

  async startRecovery() {
    this.log('START RECOVERY — initiating flash sequence...');
    this.elements.startRecoveryBtn.disabled = true;
    try {
      const data = await this.fetch('/api/recovery/start', { method: 'POST' });
      this.log('Recovery accepted — flashing in progress');
      await this.refreshRecoveryState();
    } catch (e) {
      this.log('Recovery start error: ' + e.message);
    }
  }

  toggleDiagnostics() {
    const isExpanded = this.elements.diagnosticsBody.style.display !== 'none';
    this.elements.diagnosticsBody.style.display = isExpanded ? 'none' : 'block';
    this.elements.expandDiagnostics.classList.toggle('expanded', !isExpanded);
  }

  log(message) {
    const timestamp = new Date().toTimeString().slice(0, 8);
    this.logEntries.push(`[${timestamp}] — ${message}`);
    if (this.logEntries.length > 50) this.logEntries.shift();
    this.renderLogs();
  }

  renderLogs() {
    this.elements.logContainer.innerHTML = this.logEntries
      .slice(-20)
      .reverse()
      .map(e => `<div class="log-entry new">${e}</div>`)
      .join('');
  }

  async fetch(path, options = {}) {
    const response = await fetch(this.apiBase + path, {
      headers: { 'Content-Type': 'application/json', ...this.headers },
      ...options
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ARCONET();
});
