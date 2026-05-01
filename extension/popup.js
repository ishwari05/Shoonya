/**
 * Shoonya Popup Script
 * Manages the extension popup interface
 */

class ShoonyaPopup {
  constructor() {
    this.isScanning = true;
    this.stats = {
      secretsFound: 0,
      scansToday: 0,
      blockedCount: 0
    };
    this.currentTab = null;

    this.init();
  }

  async init() {
    console.log('🔍 Shoonya Popup Initialized');

    // Load settings and stats
    await this.loadSettings();
    await this.loadStats();
    await this.getCurrentTab();

    // Setup event listeners
    this.setupEventListeners();

    // Update UI
    this.updateUI();

    // Get current page status
    await this.updatePageStatus();
  }

  async loadSettings() {
    const defaultSettings = {
      enabled: true,
      autoRedact: true,
      showWarnings: true,
      scanOnPaste: true
    };

    const result = await chrome.storage.sync.get(defaultSettings);
    this.settings = result;
    this.isScanning = this.settings.enabled;
  }

  async loadStats() {
    const defaultStats = {
      totalScans: 0,      // matches background.js key
      secretsBlocked: 0, // matches background.js key
      scansToday: 0,
      lastReset: new Date().toDateString()
    };

    const result = await chrome.storage.local.get(defaultStats);

    // Reset daily stats if needed
    if (result.lastReset !== new Date().toDateString()) {
      result.scansToday = 0;
      result.lastReset = new Date().toDateString();
      await chrome.storage.local.set(result);
    }

    this.stats = result;
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
  }

  setupEventListeners() {
    // Scan button
    document.getElementById('scanBtn').addEventListener('click', () => {
      this.scanCurrentPage();
    });

    // Restore button
    document.getElementById('restoreBtn').addEventListener('click', () => {
      this.restoreAll();
    });

    // Toggle button
    document.getElementById('toggleBtn').addEventListener('click', () => {
      this.toggleScanning();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.openHelp();
    });

    // Export Feedback button
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportFeedback();
    });

    // Report issue
    document.getElementById('reportIssue').addEventListener('click', () => {
      this.reportIssue();
    });

    // View logs
    // document.getElementById('viewLogs').addEventListener('click', () => {
      // this.viewLogs();
    // });

    // View Analytics Dashboard
    const viewAnalyticsEl = document.getElementById('viewAnalytics');
    if (viewAnalyticsEl) {
      viewAnalyticsEl.addEventListener('click', (e) => {
        e.preventDefault();
        this.openDashboard();
      });
    }

    // Dashboard Button (Quick Action)
    const dashboardBtnEl = document.getElementById('dashboardBtn');
    if (dashboardBtnEl) {
      dashboardBtnEl.addEventListener('click', () => {
        this.openDashboard();
      });
    }

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleContentMessage(message, sender, sendResponse);
    });
  }

  updateUI() {
    // Update status indicator
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusPill = document.getElementById('statusIndicator');

    if (this.isScanning) {
      statusDot.classList.remove('inactive');
      statusText.textContent = 'Active';
      statusPill.classList.remove('inactive');
      statusPill.classList.add('active');
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = 'Paused';
      statusPill.classList.remove('active');
      statusPill.classList.add('inactive');
    }

    // Update stats
    document.getElementById('secretsCount').textContent = this.stats.totalScans || 0;
    document.getElementById('scansCount').textContent = this.stats.scansToday || 0;
    document.getElementById('blockedCount').textContent = this.stats.secretsBlocked || 0;

    // Update protection level
    this.updateProtectionLevel();
  }

  updateProtectionLevel() {
    const levelElement = document.getElementById('protectionLevel');
    const fillElement = document.getElementById('levelFill');
    const descElement = document.getElementById('levelDescription');

    if (!this.isScanning) {
      levelElement.textContent = 'Off';
      levelElement.style.color = 'var(--accent-red)';
      fillElement.style.width = '0%';
      fillElement.style.background = 'var(--accent-red)';
      descElement.textContent = 'Protection is disabled';
    } else if (this.settings.autoRedact && this.settings.showWarnings) {
      levelElement.textContent = 'High';
      levelElement.style.color = 'var(--accent-green)';
      fillElement.style.width = '100%';
      fillElement.style.background = 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))';
      descElement.textContent = 'Full protection active';
    } else if (this.settings.autoRedact || this.settings.showWarnings) {
      levelElement.textContent = 'Medium';
      levelElement.style.color = 'var(--accent-amber)';
      fillElement.style.width = '60%';
      fillElement.style.background = 'linear-gradient(90deg, var(--accent-amber), var(--accent-red))';
      descElement.textContent = 'Partial protection enabled';
    } else {
      levelElement.textContent = 'Low';
      levelElement.style.color = 'var(--accent-red)';
      fillElement.style.width = '30%';
      fillElement.style.background = 'var(--accent-red)';
      descElement.textContent = 'Minimal protection — scanning only';
    }
  }

  async updatePageStatus() {
    if (!this.currentTab) return;

    const pageUrl = document.getElementById('pageUrl');
    const pageStatus = document.getElementById('pageStatus');

    // Update URL
    pageUrl.textContent = this.getDomainFromUrl(this.currentTab.url);

    // Check if page is supported
    const supportedDomains = [
      'chat.openai.com',
      'chatgpt.com',
      'copilot.microsoft.com',
      'github.com/copilot',
      'claude.ai',
      'bard.google.com',
      'gemini.google.com'
    ];

    const domain = this.getDomainFromUrl(this.currentTab.url);
    const isSupported = supportedDomains.some(supported => domain.includes(supported));

    if (isSupported) {
      pageStatus.textContent = 'Protected';
      pageStatus.classList.remove('warning');
    } else {
      pageStatus.textContent = 'Not optimized for this site';
      pageStatus.classList.add('warning');
    }

    // Get scan results from content script
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        type: 'getScanResults'
      });

      if (response && response.success && Array.isArray(response.secretsFound)) {
        this.displaySecrets(response.secretsFound);
      } else {
        this.displaySecrets([]);
      }
    } catch (error) {
      console.log('Content script not available:', error);
      this.displaySecrets([]);
    }
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'Unknown';
    }
  }

  displaySecrets(secrets) {
    const secretsSection = document.getElementById('secretsSection');
    const secretsList = document.getElementById('secretsList');
    const detectionCount = document.getElementById('detectionCount');
    const secretList = Array.isArray(secrets) ? secrets : [];

    detectionCount.textContent = secretList.length;

    if (secretList.length === 0) {
      secretsSection.style.display = 'none';
      return;
    }

    secretsSection.style.display = 'block';
    secretsList.innerHTML = '';

    secretList.forEach(secret => {
      const secretItem = document.createElement('div');
      secretItem.className = 'secret-item';
      secretItem.innerHTML = `
        <span class="secret-type">${secret.type}</span>
        <span class="secret-value">${this.truncateSecret(secret.value)}</span>
      `;
      secretsList.appendChild(secretItem);
    });
  }

  truncateSecret(value) {
    if (value.length <= 15) return value;
    return value.substring(0, 8) + '...' + value.substring(value.length - 4);
  }

  async scanCurrentPage() {
    if (!this.currentTab) {
      this.showNotification('No active tab found', 'error');
      return;
    }

    this.showLoading(true);

    try {
      console.log('🔍 Sending scan message to tab:', this.currentTab.id);
      console.log('🔍 Tab URL:', this.currentTab.url);

      // First check if content script is loaded
      try {
        const testResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
          type: 'ping'
        });
        console.log('🏓 Content script is responsive');
      } catch (pingError) {
        console.log('❌ Content script not loaded:', pingError.message);
        this.showNotification('Content script not loaded. Refresh the page and try again.', 'error');
        this.showLoading(false);
        return;
      }

      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        type: 'scanCurrentPage'
      });

      if (response && response.success) {
        // Update stats
        this.stats.scansToday++;
        await chrome.storage.local.set({ scansToday: this.stats.scansToday });
        this.updateUI();

        this.showNotification('Scan completed successfully', 'success');

        // Refresh page status
        setTimeout(() => {
          this.updatePageStatus();
          this.showLoading(false);
        }, 1000);
      } else {
        throw new Error('No response from content script');
      }

    } catch (error) {
      console.error('Scan failed:', error);
      this.showLoading(false);

      if (error.message.includes('Could not establish connection')) {
        this.showNotification('Extension not loaded on this page. Refresh the page and try again.', 'error');
      } else {
        this.showNotification('Scan failed. Try refreshing the page.', 'error');
      }
    }
  }

  async restoreAll() {
    if (!this.currentTab) return;

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        type: 'restoreAll'
      });

      if (response && response.success) {
        this.showNotification('All redacted content restored', 'success');
      } else {
        throw new Error('Restore operation failed');
      }

      // Refresh page status
      setTimeout(() => this.updatePageStatus(), 500);

    } catch (error) {
      console.error('Restore failed:', error);

      if (error.message.includes('Could not establish connection')) {
        this.showNotification('Extension not loaded on this page. Refresh the page and try again.', 'error');
      } else {
        this.showNotification('Restore failed. Try refreshing the page.', 'error');
      }
    }
  }

  async toggleScanning() {
    this.isScanning = !this.isScanning;
    this.settings.enabled = this.isScanning;

    await chrome.storage.sync.set({ enabled: this.isScanning });

    // Notify content script
    if (this.currentTab) {
      try {
        await chrome.tabs.sendMessage(this.currentTab.id, {
          type: 'toggleScanning',
          enabled: this.isScanning
        });
      } catch (error) {
        console.log('Content script not available:', error);
      }
    }

    this.updateUI();
    this.showNotification(
      this.isScanning ? 'Scanning enabled' : 'Scanning paused',
      'success'
    );
  }

  openSettings() {
    try {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // Fallback: open options.html directly
        chrome.tabs.create({ url: 'options.html' });
      }
    } catch (error) {
      console.error('Failed to open settings:', error);
      this.showNotification('Settings page unavailable', 'error');
    }
  }

  openHelp() {
    chrome.tabs.create({
      url: 'https://github.com/ishwari05/shoonya-security#readme'
    });
  }

  async exportFeedback() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'exportFeedback' });
      if (response && response.success && response.data) {
        if (response.data.length === 0) {
          this.showNotification('No feedback collected yet', 'info');
          return;
        }
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url: url,
          filename: 'shoonya_feedback.json',
          saveAs: true
        });
      } else {
        throw new Error(response.error || 'Failed to export');
      }
    } catch (err) {
      console.error('Export failed:', err);
      this.showNotification('Failed to export feedback', 'error');
    }
  }

  reportIssue() {
    chrome.tabs.create({
      url: 'https://github.com/ishwari05/shoonya-security/issues/new'
    });
  }

  viewLogs() {
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id
    });
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to popup
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  handleContentMessage(message, sender, sendResponse) {
    if (message.type === 'secretsDetected') {
      const secretsFound = Array.isArray(message?.data?.secretsFound)
        ? message.data.secretsFound
        : [];

      // Read fresh stats from storage (background may have updated them)
      chrome.storage.local.get(['totalScans', 'secretsBlocked'], (result) => {
        this.stats.totalScans = result.totalScans || this.stats.totalScans;
        this.stats.secretsBlocked = result.secretsBlocked || this.stats.secretsBlocked;
        this.updateUI();
      });

      this.displaySecrets(secretsFound);

      // Show notification for high-risk detections
      if (secretsFound.length > 2) {
        this.showNotification(
          `${secretsFound.length} secrets detected and blocked!`,
          'warning'
        );
      }
    }

    sendResponse({ received: true });
    this.isScanning = false;
    this.updateUI();
  }

  openDashboard() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard/index.html')
    });
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ShoonyaPopup();
});
