/**
 * Shoonya.ai Content Script
 * Integrated Hybrid Detection: Regex (Local) + DistilBERT/Entropy (Background)
 */

console.log('🔥 DEBUG: Shoonya.ai content script is loading!');

class ShoonyaContent {
  constructor() {
    this.isScanning = false;
    this.scanTimer = null;
    this.lastScannedText = new WeakMap();
    this.originalContent = new Map();
    this.redactedContent = new Map();
    this.detectedSecrets = [];
    this.lastScanTime = 0;
    this.settings = { enabled: true, autoRedact: true, showWarnings: true, scanOnPaste: true };

    this.init();
  }

  async init() {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('⚠️ Extension context invalidated');
      return;
    }

    console.log('🔍 Shoonya.ai Content Script Initialized');
    this.settings = await this.loadSettings();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true;
    });

    if (this.settings.enabled) {
      this.startScanning();
    }

    this.observePage();
    document.addEventListener('selectionchange', this.handleSelection.bind(this));
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.shoonya-report-btn')) {
        this.hideReportButton();
      }
    });
  }

  // --- INDIAN ENTITY & UUID PROTECTION ---
  applyIndianHeuristics(text) {
    const patterns = {
      GSTIN: /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/g,
      PINCODE: /\b(632\d{3}|[1-9][0-9]{2}\s?[0-9]{3})\b/g,
      PAN_CARD: /\b[A-Z]{5}\d{4}[A-Z]{1}\b/g,
      PHONE: /(?:\+91|91|0)?[6-9]\d{9}|[6-9]\d{4}[\-\s]\d{5}/g
    };

    let localSecrets = [];
    let processedText = text;

    for (const [label, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m);
          if (isUUID) return;

          localSecrets.push({ type: label, value: m });
          processedText = processedText.replace(m, `[LOCAL_${label}_REDACTED]`);
        });
      }
    }
    return { processedText, localSecrets };
  }

  async loadSettings() {
    if (!chrome.runtime || !chrome.runtime.id) return { enabled: true, autoRedact: true, showWarnings: true, scanOnPaste: true };
    try {
      return await chrome.storage.sync.get({ enabled: true, autoRedact: true, showWarnings: true, scanOnPaste: true });
    } catch (error) {
      return { enabled: true, autoRedact: true, showWarnings: true, scanOnPaste: true };
    }
  }

  startScanning() {
    this.isScanning = true;
    this.scanCurrentPage();
    document.addEventListener('input', this.handleInput.bind(this));
    document.addEventListener('paste', this.handlePaste.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  stopScanning() {
    this.isScanning = false;
    if (this.scanTimer) clearTimeout(this.scanTimer);
  }

  resolveEditableRoot(element) {
    if (!element || !element.tagName) return element;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return element;
    const chatGptRoot = element.closest('#prompt-textarea') || element.closest('.ProseMirror');
    if (chatGptRoot) return chatGptRoot;
    const contentEditable = element.closest('[contenteditable="true"]');
    if (contentEditable) return contentEditable;
    return element;
  }

  handleInput(event) {
    if (!this.isScanning) return;
    const root = this.resolveEditableRoot(event.target);
    if (this.isCodeElement(root)) this.debouncedScan(root);
  }

  handlePaste(event) {
    if (!this.isScanning || !this.settings.scanOnPaste) return;
    const root = this.resolveEditableRoot(event.target);
    if (this.isCodeElement(root)) setTimeout(() => this.debouncedScan(root), 100);
  }

  handleKeyUp(event) {
    if (!this.isScanning) return;
    const root = this.resolveEditableRoot(event.target);
    if (this.isCodeElement(root)) this.debouncedScan(root);
  }

  isCodeElement(element) {
    const codeSelectors = ['textarea', 'input', 'pre', 'code', '[role="textbox"]', '[contenteditable="true"]', '#prompt-textarea', '.ProseMirror'];
    return codeSelectors.some(selector => element.matches?.(selector) || element.closest?.(selector));
  }

  debouncedScan(element) {
    if (!this.isScanning) return;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    const textLength = this.getElementText(element)?.length || 0;
    const delay = textLength > 20_000 ? 2000 : textLength > 5_000 ? 1000 : 500;
    this.scanTimer = setTimeout(() => {
      if (this.isScanning) this.scanElement(element);
    }, delay);
  }

  async scanElement(element, force = false) {
    const text = this.getElementText(element);
    if (!text || text.length < 10) return;

    if (/\[[A-Z_]+_\d+\]|\[LOCAL_[A-Z_]+_REDACTED\]/.test(text)) return;

    if (!force && this.lastScannedText.get(element) === text) return;
    this.lastScannedText.set(element, text);

    const { processedText, localSecrets } = this.applyIndianHeuristics(text);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "scanText",
        text: localSecrets.length > 0 ? processedText : text
      });

      if (response && response.success && response.data) {
        const result = response.data;
        const totalSecrets = [...localSecrets, ...result.secretsFound];

        if (totalSecrets.length > 0) {
          const finalResult = {
            ...result,
            secretsFound: totalSecrets,
            redactedCode: result.redactedCode === text ? processedText : result.redactedCode
          };
          this.handleSecretsFound(element, finalResult);
        }
      }
    } catch (error) {
      console.warn("⚠️ Local fallback triggered:", error);
      if (localSecrets.length > 0) {
        this.handleSecretsFound(element, { secretsFound: localSecrets, redactedCode: processedText });
      }
    }
  }

  getElementText(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return element.value;
    const isEditable = element.contentEditable === 'true' || element.classList?.contains('ProseMirror') || element.id === 'prompt-textarea';
    if (isEditable) return element.innerText || element.textContent;
    return element.textContent || element.innerText;
  }

  setElementText(element, text) {
    const wasScanning = this.isScanning;
    this.isScanning = false;

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(element, text);
      } else {
        element.value = text;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

    } else if (element.contentEditable === 'true' || element.classList?.contains('ProseMirror') || element.id === 'prompt-textarea') {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = escaped.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
      element.innerHTML = html;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    }

    setTimeout(() => { this.isScanning = wasScanning; }, 1000);
  }

  handleSecretsFound(element, result) {
    this.detectedSecrets = result.secretsFound;
    if (this.settings.autoRedact) this.redactElement(element, result);
    const now = Date.now();
    if (now - this.lastScanTime < 2000) return;
    this.lastScanTime = now;
    if (this.settings.showWarnings) this.showWarning(element, result);
    this.notifyPopup(result);
  }

  showWarning(element, result) {
    document.querySelectorAll('.shoonya-warning').forEach(w => w.remove());

    const warning = document.createElement('div');
    warning.className = 'shoonya-warning';
    warning.innerHTML = `
      <div class="shoonya-warning-content">
        <span class="shoonya-icon">🛡️</span>
        <span class="shoonya-text">${result.secretsFound.length} secrets sanitized!</span>
        <button class="shoonya-close-btn">×</button>
      </div>
      <div class="shoonya-feedback">
        <button class="shoonya-fb-btn shoonya-fb-yes">👍 Accurate</button>
        <button class="shoonya-fb-btn shoonya-fb-no">👎 False Positive</button>
      </div>`;

    if (element.parentNode) element.parentNode.insertBefore(warning, element);
    warning.querySelector('.shoonya-close-btn').addEventListener('click', () => warning.remove());

    const sendFeedback = (label) => {
      chrome.runtime.sendMessage({ type: 'saveFeedback', data: { label, secrets: result.secretsFound.length } });
      warning.querySelector('.shoonya-feedback').innerHTML = `<span>Feedback saved! ✓</span>`;
    };

    warning.querySelector('.shoonya-fb-yes').addEventListener('click', () => sendFeedback('correct'));
    warning.querySelector('.shoonya-fb-no').addEventListener('click', () => sendFeedback('false_positive'));
    setTimeout(() => { if (warning.parentNode) warning.remove(); }, 8000);
  }

  handleSelection() {
    if (!this.settings.enabled) return;
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length < 10) { this.hideReportButton(); return; }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const root = this.resolveEditableRoot(selection.anchorNode);
    if (this.isCodeElement(root)) this.showReportButton(rect, selection.toString().trim(), root);
  }

  hideReportButton() {
    const existing = document.getElementById('cs-report-btn');
    if (existing) existing.remove();
  }

  showReportButton(rect, selectedText, element) {
    this.hideReportButton();
    const btn = document.createElement('button');
    btn.id = 'cs-report-btn';
    btn.className = 'shoonya-report-btn';
    btn.innerHTML = '🛡️ Report Leak';
    btn.style.position = 'absolute';
    btn.style.top = `${window.scrollY + rect.top - 40}px`;
    btn.style.left = `${window.scrollX + rect.left + (rect.width / 2)}px`;
    btn.style.transform = 'translateX(-50%)';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'saveFeedback', data: { label: 'missed_secret', value: selectedText } });
      btn.innerHTML = '✓ Reported';
      setTimeout(() => this.hideReportButton(), 1500);
    });
  }

  redactElement(element, result) {
    const originalText = this.getElementText(element);
    this.originalContent.set(element, originalText);
    this.setElementText(element, result.redactedCode);
    this.redactedContent.set(element, result.mapping);
    element.classList.add('shoonya-redacted');
  }

  restoreElement(element) {
    const originalText = this.originalContent.get(element);
    if (originalText) {
      this.setElementText(element, originalText);
      element.classList.remove('shoonya-redacted');
      this.originalContent.delete(element);
    }
  }

  handleMessage(message, sendResponse) {
    switch (message.type) {
      case 'ping': sendResponse({ success: true }); break;
      case 'toggleScanning': message.enabled ? this.startScanning() : this.stopScanning(); sendResponse({ success: true }); break;
      case 'restoreAll': this.originalContent.forEach((_, element) => this.restoreElement(element)); sendResponse({ success: true }); break;
      case 'scanCurrentPage': this.scanCurrentPage(); sendResponse({ success: true }); break;
      case 'getScanResults': sendResponse({ success: true, secretsFound: this.detectedSecrets || [] }); break;
      default: sendResponse({ success: false });
    }
  }

  scanCurrentPage() {
    document.querySelectorAll('textarea, input, [contenteditable="true"], #prompt-textarea, .ProseMirror').forEach(element => {
      this.scanElement(element, true);
    });
  }

  observePage() {
    const observer = new MutationObserver((mutations) => {
      if (!this.isScanning) return;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const target = this.resolveEditableRoot(node);
            if (this.isCodeElement(target)) this.debouncedScan(target);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  notifyPopup(result) {
    try {
      chrome.runtime.sendMessage({
        type: 'secretsDetected',
        data: {
          count: result.secretsFound.length,
          secretsFound: result.secretsFound
        }
      });
    } catch (e) { }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ShoonyaContent());
} else {
  new ShoonyaContent();
}