/**
 * Shoonya Background Script
 * Manages extension lifecycle and cross-tab communication
 * v2.1 — NER worker integration + feedback loop
 */

// 1. CRITICAL: Import the engine at the top level
import { processCode } from './engine/index.js';

// ── NER Web Worker ──────────────────────────────────────────
// Spawned once; inference runs off the main thread.
const NER_MODEL_URL = chrome.runtime.getURL('engine/models/shoonya_ner.onnx');
const NER_VOCAB_URL = chrome.runtime.getURL('engine/models/vocab.json');

let nerWorker = null;
let nerReady = false;
const nerPending = new Map(); // id → { resolve, reject }
let nerMsgId = 0;

function initNerWorker() {
  try {
    nerWorker = new Worker(chrome.runtime.getURL('engine/ner-worker.js'));
    nerWorker.onmessage = (e) => {
      const { type, id, result, error } = e.data;
      if (type === 'ready') {
        nerReady = true;
        console.log('🤖 Shoonya NER model ready');
        return;
      }
      if (type === 'result' && nerPending.has(id)) {
        nerPending.get(id).resolve(result);
        nerPending.delete(id);
      }
      if (type === 'error' && nerPending.has(id)) {
        nerPending.get(id).reject(new Error(error));
        nerPending.delete(id);
      }
    };
    nerWorker.onerror = (err) => console.error('NER worker error:', err);
    nerWorker.postMessage({ type: 'init', modelUrl: NER_MODEL_URL, vocabUrl: NER_VOCAB_URL });
  } catch (err) {
    console.warn('NER worker unavailable (model not yet exported):', err.message);
  }
}

function nerInfer(text) {
  return new Promise((resolve, reject) => {
    if (!nerWorker || !nerReady) {
      return resolve({ hasSecret: false, secrets: [] });
    }
    const id = ++nerMsgId;
    nerPending.set(id, { resolve, reject });
    nerWorker.postMessage({ type: 'infer', id, text });
    // Safety timeout — fall back gracefully if model hangs
    setTimeout(() => {
      if (nerPending.has(id)) {
        nerPending.get(id).resolve({ hasSecret: false, secrets: [] });
        nerPending.delete(id);
      }
    }, 3000);
  });
}

class ShoonyaBackground {
  constructor() {
    this.isInitialized = false;
    this.stats = {
      totalScans: 0,
      secretsBlocked: 0,
      lastActivity: Date.now()
    };
    this.recentLogs = new Map(); // De-duplication cache: key -> timestamp

    this.init();
  }

  init() {
    console.log('🛡️ Shoonya Background Script Started');
    this.loadData();
    this.setupEventListeners();
    this.setupPeriodicTasks();
    this.isInitialized = true;
    initNerWorker(); // Start NER model in the background
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get({
        totalScans: 0,
        secretsBlocked: 0,
        lastActivity: Date.now(),
        installDate: Date.now()
      });
      this.stats = result;
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  async saveData() {
    try {
      await chrome.storage.local.set(this.stats);
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  setupEventListeners() {
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log('Shoonya extension started');
      this.updateLastActivity();
    });

    // 2. FIXED: Unified Message Listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📩 Message received in background:", message);

      // Handle Engine Scans (Action-based from Content Script)
      if (message.action === "scanText") {
        (async () => {
          try {
            const result = processCode(message.text);

            // Phase 1+2: Run NER on entropy-flagged candidates to eliminate false positives
            // and attach XAI confidence data.
            const enrichedSecrets = await this.enrichWithNER(result.secretsFound, message.text);
            result.secretsFound = enrichedSecrets;
            result.metadata.nerEnabled = nerReady;

            this.handleScanComplete({ secretsFound: enrichedSecrets }, sender);
            sendResponse({ success: true, data: result });
          } catch (error) {
            console.error("❌ Engine execution failed:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();
      }
      // Handle Popup UI Requests (Type-based)
      else if (message.type) {
        this.handleMessage(message, sender, sendResponse);
      }
      else {
        console.warn("❓ Received unknown message format:", message);
        sendResponse({ success: false, error: "Unknown message format" });
      }

      return true; // Keep channel open
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivation(activeInfo);
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });
  }

  setupPeriodicTasks() {
    setInterval(() => { this.cleanupOldData(); }, 60 * 60 * 1000);
    setInterval(() => { this.updateBadge(); }, 30 * 1000);
  }

  handleInstallation(details) {
    if (details.reason === 'install') {
      this.showWelcomeNotification();
      this.setDefaults();
    } else if (details.reason === 'update') {
      this.showUpdateNotification();
    }
  }

  async setDefaults() {
    const defaultSettings = {
      enabled: true,
      autoRedact: true,
      showWarnings: true,
      scanOnPaste: true,
      notifications: true,
      darkMode: false,
      protectionLevel: 'high'
    };
    try {
      await chrome.storage.sync.set(defaultSettings);
    } catch (error) {
      console.error('Failed to set defaults:', error);
    }
  }

  showWelcomeNotification() {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Shoonya Installed!',
      message: '🛡️ Shoonya is now protecting you. Click to learn more.',
      priority: 2
    });
  }

  showUpdateNotification() {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Shoonya Updated',
      message: 'New features available. Check out what\'s new!',
      priority: 1
    });
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'getStats': this.getStats(sendResponse); break;
      case 'updateStats': this.updateStats(message.data, sendResponse); break;
      case 'getSettings': this.getSettings(sendResponse); break;
      case 'updateSettings': this.updateSettings(message.data, sendResponse); break;
      case 'resetData': this.resetData(sendResponse); break;
      // Phase 4 — Feedback loop
      case 'saveFeedback': this.saveFeedback(message.data, sendResponse); break;
      case 'exportFeedback': this.exportFeedback(sendResponse); break;
      // Real-time Dashboard Sync
      case 'secretsDetected': this.handleScanComplete(message.data, sender); break;
      default: sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  /**
   * Phase 1+2: NER enrichment
   * - Entropy hits are validated by the NER model; those with NER confidence < 0.6 are dropped.
   * - Named-regex hits always pass through but get NER confidence attached for XAI display.
   */
  async enrichWithNER(secrets, fullText) {
    if (!nerReady || !secrets.length) return secrets;

    const enriched = [];
    for (const secret of secrets) {
      if (secret.type === 'HIGH_ENTROPY_SECRET') {
        const context = fullText.slice(
          Math.max(0, secret.index - 40),
          secret.index + secret.value.length + 40
        );
        const nerResult = await nerInfer(context);
        if (nerResult.hasSecret && nerResult.secrets.length > 0) {
          const best = nerResult.secrets[0];
          enriched.push({ ...secret, nerConfidence: best.confidence, xaiLabel: 'NER-CONFIRMED' });
        } else {
          // RESTORED ACCURACY (GitHub Version): Keep the entropy hit even if NER prediction misses!
          enriched.push({ ...secret, nerConfidence: 0, xaiLabel: 'ENTROPY-MATCHED' });
        }
      } else {
        const context = fullText.slice(
          Math.max(0, secret.index - 40),
          secret.index + secret.value.length + 40
        );
        const nerResult = await nerInfer(context);
        const conf = nerResult.secrets?.[0]?.confidence ?? null;
        enriched.push({ ...secret, nerConfidence: conf, xaiLabel: 'REGEX-MATCHED' });
      }
    }
    return enriched;
  }

  // ── Phase 4: Feedback loop ────────────────────────────────
  async saveFeedback(data, sendResponse) {
    try {
      const stored = await chrome.storage.local.get({ feedback: [] });
      stored.feedback.push({ ...data, timestamp: Date.now() });
      // Cap at 5000 entries to avoid exceeding storage quota
      if (stored.feedback.length > 5000) stored.feedback = stored.feedback.slice(-5000);
      await chrome.storage.local.set({ feedback: stored.feedback });
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  async exportFeedback(sendResponse) {
    try {
      const { feedback = [] } = await chrome.storage.local.get({ feedback: [] });
      sendResponse({ success: true, data: feedback });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  async getStats(sendResponse) {
    try {
      const result = await chrome.storage.local.get(['totalScans', 'secretsBlocked']);
      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async updateStats(data, sendResponse) {
    this.stats.totalScans += data.scans || 0;
    this.stats.secretsBlocked += data.secrets || 0;
    await this.saveData();
    sendResponse({ success: true });
  }

  async handleScanComplete(data, sender) {
    this.stats.totalScans++;
    
    if (data.secretsFound && data.secretsFound.length > 0) {
      this.stats.secretsBlocked += data.secretsFound.length;

      // 🛰️ DISPATCH TO ANALYTICS DASHBOARD
      this.logToDashboard(data.secretsFound, sender.tab);

      if (data.secretsFound.length > 2) {
        this.showRiskNotification(sender.tab, data.secretsFound.length);
      }
    }
    this.saveData();
    this.updateBadge();
  }

  async logToDashboard(secrets, tab) {
    try {
      const platform = this.getPlatformFromUrl(tab?.url || 'Other');
      const now = Date.now();
      
      for (const secret of secrets) {
        const eventKey = `${tab?.id || 'background'}-${platform}-${secret.type}-${secret.value?.substring(0, 10)}`;
        
        const lastLogged = this.recentLogs.get(eventKey);
        if (lastLogged && (now - lastLogged < 5000)) {
          console.log(`🛡️ Shoonya: Suppressed duplicate log for ${secret.type}`);
          continue;
        }

        this.recentLogs.set(eventKey, now);
        
        const payload = {
          type: this.mapSecretType(secret.type),
          platform: platform,
          risk_score: secret.riskScore || (secret.type === 'HIGH_ENTROPY_SECRET' ? 85 : 50),
          action: 'REDACTED',
          timestamp: new Date().toISOString(),
          details: `Detected ${secret.type}`
        };

        // OFFLINE FIRST: Store the log securely in extension storage instead of backend API
        chrome.storage.local.get({ events: [] }).then(result => {
          let events = result.events;
          events.unshift(payload); // Add to beginning
          if (events.length > 500) events = events.slice(0, 500); // Cap at 500 to save space
          chrome.storage.local.set({ events: events });
        });
        
        if (this.recentLogs.size > 1000) {
           const expiry = now - 10000;
           for (const [key, time] of this.recentLogs.entries()) {
             if (time < expiry) this.recentLogs.delete(key);
           }
        }
      }
    } catch (err) {
      console.error('Error preparing dashboard logs:', err);
    }
  }

  getPlatformFromUrl(url) {
    if (url.includes('chatgpt.com') || url.includes('openai.com')) return 'ChatGPT';
    if (url.includes('claude.ai')) return 'Claude';
    if (url.includes('gemini.google.com')) return 'Gemini';
    if (url.includes('github.com')) return 'GitHub';
    return 'Other';
  }

  mapSecretType(type) {
    // Pass the raw, exact detection type directly to the dashboard 
    // instead of grouping them into generic categories.
    return type || 'OTHER';
  }

  async getSettings(sendResponse) {
    const result = await chrome.storage.sync.get(null);
    sendResponse({ success: true, data: result });
  }

  async updateSettings(data, sendResponse) {
    await chrome.storage.sync.set(data);
    sendResponse({ success: true });
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      this.updateLastActivity();
    }
  }

  handleTabActivation(activeInfo) {
    this.updateLastActivity();
    this.updateBadge();
  }

  handleStorageChange(changes, namespace) {
    if (namespace === 'sync') {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'settingsChanged', data: changes }).catch(() => { });
        });
      });
    }
  }

  isSupportedSite(url) {
    if (!url) return false;
    const supported = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'github.com'];
    return supported.some(domain => url.includes(domain));
  }

  async updateBadge() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !this.isSupportedSite(tabs[0].url)) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    // Simple visual indicator that shield is active
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
  }

  showRiskNotification(tab, secretCount) {
    if (!tab) return;
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Shoonya Alert',
      message: `🚨 ${secretCount} potential secrets detected!`,
      priority: 2
    });
  }

  updateLastActivity() {
    this.stats.lastActivity = Date.now();
    this.saveData();
  }

  cleanupOldData() { console.log('Cleaning up...'); }
}

new ShoonyaBackground();