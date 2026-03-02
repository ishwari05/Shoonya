/**
 * CodeShield Content Script (The Brawn)
 * Reads the web page and sends text to the background worker for scanning.
 */

console.log('🔥 DEBUG: CodeShield content script is loading!');

class CodeShieldContent {
  constructor() {
    this.isScanning = false;  // start false until settings confirm enabled
    this.scanDebounce = 500;
    this.scanTimer = null;
    this.lastScannedText = new WeakMap();
    this.originalContent = new Map();
    this.redactedContent = new Map();
    this.detectedSecrets = [];
    this.lastScanTime = 0;
    // Safe defaults so this.settings is NEVER undefined (race condition fix)
    this.settings = { enabled: true, autoRedact: true, showWarnings: true, scanOnPaste: true };

    this.init();
  }

  async init() {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('⚠️ Extension context invalidated');
      return;
    }

    console.log('🔍 CodeShield Content Script Initialized');

    // Await settings before anything else — prevents this.settings being undefined
    this.settings = await this.loadSettings();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true;
    });

    if (this.settings.enabled) {
      this.startScanning();
    }

    this.observePage();
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

  // Resolves the actual editable root (e.g. walks up from <p> to the contenteditable div)
  // This is critical for ChatGPT/Gemini where events fire on inner child elements
  resolveEditableRoot(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return element;
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
    const codeSelectors = ['textarea', 'input', 'pre', 'code', '[role="textbox"]', '[contenteditable="true"]'];
    return codeSelectors.some(selector => element.matches?.(selector) || element.closest?.(selector));
  }

  debouncedScan(element) {
    if (!this.isScanning) return;
    if (this.scanTimer) clearTimeout(this.scanTimer);

    this.scanTimer = setTimeout(() => {
      if (this.isScanning) this.scanElement(element);
    }, this.scanDebounce);
  }

  async scanElement(element, force = false) {
    const text = this.getElementText(element);
    if (!text || text.length < 10) return;

    // Bug #1 Fix: skip only if text hasn't changed since last scan
    // This allows re-scanning the same element when the user types a new message
    if (!force && this.lastScannedText.get(element) === text) return;
    this.lastScannedText.set(element, text);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "scanText",
        text: text
      });

      if (response && response.success && response.data) {
        const result = response.data;

        if (result.secretsFound.length > 0) {
          console.log('🚨 CodeShield detected secrets:', result.secretsFound);
          this.handleSecretsFound(element, result);
        }
      }
    } catch (error) {
      console.warn("⚠️ CodeShield could not reach the background engine:", error);
      // Clear cached text so next attempt retries
      this.lastScannedText.delete(element);
    }
  }

  getElementText(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return element.value;
    // Use innerText for contenteditable — it preserves \n between <p> tags.
    // textContent merges paragraphs without newlines, causing wrong regex indices.
    if (element.contentEditable === 'true') return element.innerText || element.textContent;
    return element.textContent || element.innerText;
  }

  setElementText(element, text) {
    // Bug #2 Fix: React apps (ChatGPT, Gemini) ignore direct .value or .textContent changes.
    // We must use the native prototype setter to trigger React's synthetic event system.
    const wasScanning = this.isScanning;
    this.isScanning = false;

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // Use native setter so React's onChange handler fires correctly
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(element, text);
      } else {
        element.value = text; // Fallback for non-React pages
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

    } else if (element.contentEditable === 'true') {
      // Build HTML matching ChatGPT/Gemini's paragraph-per-line format.
      // execCommand('insertText') is unreliable on nested contenteditable divs.
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const html = escaped.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
      element.innerHTML = html;
      // Dispatch InputEvent so React reads the updated textContent
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: text
      }));
    }

    setTimeout(() => { this.isScanning = wasScanning; }, 1000); // 1s lock prevents re-scan loop
  }

  handleSecretsFound(element, result) {
    this.detectedSecrets = result.secretsFound;

    // Always redact — don't let the warning throttle block it
    if (this.settings.autoRedact) this.redactElement(element, result);

    // Only throttle the warning banner (avoid spamming UI)
    const now = Date.now();
    if (now - this.lastScanTime < 2000) return;
    this.lastScanTime = now;

    if (this.settings.showWarnings) this.showWarning(element, result);
    this.notifyPopup(result);
  }

  showWarning(element, result) {
    document.querySelectorAll('.codeshield-warning').forEach(w => w.remove());

    const warning = document.createElement('div');
    warning.className = 'codeshield-warning';
    warning.innerHTML = `
      <div class="codeshield-warning-content">
        <span class="codeshield-icon">⚠️</span>
        <span class="codeshield-text">${result.secretsFound.length} secret(s) detected!</span>
        <button class="codeshield-close-btn">×</button>
      </div>
    `;

    if (element.parentNode) element.parentNode.insertBefore(warning, element);
    warning.querySelector('.codeshield-close-btn').addEventListener('click', () => warning.remove());
    setTimeout(() => { if (warning.parentNode) warning.remove(); }, 5000);
  }

  redactElement(element, result) {
    const originalText = this.getElementText(element);
    this.originalContent.set(element, originalText);
    this.setElementText(element, result.redactedCode);
    this.redactedContent.set(element, result.mapping);
    element.classList.add('codeshield-redacted');
  }

  // FIXED: Added missing restoreElement function
  restoreElement(element) {
    const originalText = this.originalContent.get(element);
    if (originalText) {
      this.setElementText(element, originalText);
      element.classList.remove('codeshield-redacted');
      this.originalContent.delete(element);
      this.redactedContent.delete(element);
    }
  }

  notifyPopup(result) {
    if (!chrome.runtime || !chrome.runtime.id) return;
    try {
      chrome.runtime.sendMessage({
        type: 'secretsDetected',
        data: { secretsFound: result.secretsFound.length, url: window.location.href, timestamp: Date.now() }
      });
    } catch (error) { }
  }

  // FIXED: Rewritten with proper radio receivers
  handleMessage(message, sendResponse) {
    console.log('📨 Handling message from popup:', message.type);

    switch (message.type) {
      case 'ping':
        sendResponse({ success: true });
        break;
      case 'getScanResults':
        sendResponse({ secretsFound: this.detectedSecrets, redactedElements: Array.from(this.redactedContent.keys()) });
        break;
      case 'toggleScanning':
        message.enabled ? this.startScanning() : this.stopScanning();
        sendResponse({ success: true });
        break;
      case 'scanCurrentPage':
        this.scanCurrentPage();
        sendResponse({ success: true });
        break;
      case 'restoreAll':
        this.originalContent.forEach((_, element) => this.restoreElement(element));
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown command' });
    }
  }

  scanCurrentPage() {
    // Bug #1 + #3 Fix: force=true bypasses the text-cache check so manual scan always runs
    document.querySelectorAll('textarea, input, [contenteditable="true"]').forEach(element => {
      this.scanElement(element, true);
    });
  }

  observePage() {
    const observer = new MutationObserver((mutations) => {
      // LOOP FIX: skip observer callbacks while we are writing redacted content
      if (!this.isScanning) return;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Walk up to the contenteditable root, not the child <p> node
            const target = this.resolveEditableRoot(node);
            if (this.isCodeElement(target)) this.debouncedScan(target);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CodeShieldContent());
} else {
  new CodeShieldContent();
}