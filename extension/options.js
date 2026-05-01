/**
 * Shoonya Options Script
 * Manages the extension settings page
 */

class ShoonyaOptions {
  constructor() {
    this.settings = {};
    this.defaultSettings = {
      enabled: true,
      autoRedact: true,
      showWarnings: true,
      scanOnPaste: true,
      showNotifications: true,
      darkMode: false,
      language: 'en',
      protectionLevel: 'high',
      sensitivity: 3,
      analytics: false,
      crashReports: true,
      dataRetention: '30',
      debugMode: false,
      customPatterns: '',
      excludedSites: ''
    };
    
    this.init();
  }

  async init() {
    console.log('⚙️ Shoonya Options Page Loaded');
    
    // Load current settings
    await this.loadSettings();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI with current settings
    this.updateUI();
    
    // Setup tab navigation
    this.setupTabNavigation();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(this.defaultSettings);
      this.settings = { ...this.defaultSettings, ...result };
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...this.defaultSettings };
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set(this.settings);
      this.showStatus('Settings saved successfully!', 'success');
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'updateSettings',
        data: this.settings
      });
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  setupEventListeners() {
    // Save button
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveFromUI();
    });

    // Reset button
    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetToDefaults();
    });

    // Clear data button
    document.getElementById('clearData').addEventListener('click', () => {
      this.clearAllData();
    });

    // Export/Import buttons
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('importData').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // Footer links
    document.getElementById('documentation').addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://github.com/ishwari05/shoonya-security#readme'
      });
    });

    document.getElementById('support').addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://github.com/ishwari05/shoonya-security/issues'
      });
    });

    document.getElementById('github').addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://github.com/ishwari05/shoonya-security'
      });
    });

    // Setting change listeners
    this.setupSettingListeners();
  }

  setupSettingListeners() {
    // Checkboxes
    const checkboxes = [
      'enabled', 'autoRedact', 'showWarnings', 'scanOnPaste',
      'showNotifications', 'darkMode', 'analytics', 'crashReports', 'debugMode'
    ];

    checkboxes.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', (e) => {
          this.settings[id] = e.target.checked;
        });
      }
    });

    // Selects
    const selects = ['language', 'protectionLevel', 'dataRetention'];
    
    selects.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', (e) => {
          this.settings[id] = e.target.value;
        });
      }
    });

    // Slider
    const sensitivitySlider = document.getElementById('sensitivity');
    if (sensitivitySlider) {
      sensitivitySlider.addEventListener('input', (e) => {
        this.settings.sensitivity = parseInt(e.target.value);
      });
    }

    // Textareas
    const textareas = ['customPatterns', 'excludedSites'];
    
    textareas.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', (e) => {
          this.settings[id] = e.target.value;
        });
      }
    });
  }

  setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update active states
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  updateUI() {
    // Update checkboxes
    Object.keys(this.settings).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = this.settings[key];
        } else if (element.tagName === 'SELECT') {
          element.value = this.settings[key];
        } else if (element.tagName === 'TEXTAREA' || element.type === 'text') {
          element.value = this.settings[key];
        } else if (element.type === 'range') {
          element.value = this.settings[key];
        }
      }
    });
  }

  saveFromUI() {
    // Collect all settings from UI
    const checkboxes = [
      'enabled', 'autoRedact', 'showWarnings', 'scanOnPaste',
      'showNotifications', 'darkMode', 'analytics', 'crashReports', 'debugMode'
    ];

    checkboxes.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.settings[id] = element.checked;
      }
    });

    const selects = ['language', 'protectionLevel', 'dataRetention'];
    
    selects.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.settings[id] = element.value;
      }
    });

    const sensitivitySlider = document.getElementById('sensitivity');
    if (sensitivitySlider) {
      this.settings.sensitivity = parseInt(sensitivitySlider.value);
    }

    const textareas = ['customPatterns', 'excludedSites'];
    
    textareas.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.settings[id] = element.value;
      }
    });

    // Save to storage
    this.saveSettings();
  }

  async resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      this.settings = { ...this.defaultSettings };
      await this.saveSettings();
      this.updateUI();
    }
  }

  async clearAllData() {
    if (confirm('Are you sure you want to clear all data? This will remove all settings, statistics, and scan history.')) {
      try {
        await chrome.storage.sync.clear();
        await chrome.storage.local.clear();
        
        // Reset to defaults
        this.settings = { ...this.defaultSettings };
        await this.saveSettings();
        this.updateUI();
        
        this.showStatus('All data cleared successfully', 'success');
      } catch (error) {
        console.error('Failed to clear data:', error);
        this.showStatus('Failed to clear data', 'error');
      }
    }
  }

  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'exportData'
      });

      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `shoonya-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showStatus('Data exported successfully', 'success');
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showStatus('Failed to export data', 'error');
    }
  }

  async importData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await chrome.runtime.sendMessage({
        type: 'importData',
        data: data
      });

      if (response.success) {
        await this.loadSettings();
        this.updateUI();
        this.showStatus('Data imported successfully', 'success');
      }
    } catch (error) {
      console.error('Import failed:', error);
      this.showStatus('Failed to import data. Please check the file format.', 'error');
    }
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ShoonyaOptions();
});
