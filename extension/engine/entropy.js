/**
 * CodeShield Entropy Module
 * Detects unknown secrets using Shannon entropy analysis
 */

/**
 * Calculates Shannon entropy for a given string
 * @param {string} str - The string to calculate entropy for
 * @returns {number} The entropy value
 */
export function calculateEntropy(str) {
  if (!str || typeof str !== 'string') {
    return 0;
  }

  const len = str.length;
  if (len === 0) {
    return 0;
  }

  // Count character frequencies
  const freq = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }

  // Calculate Shannon entropy
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Tokenizes text into individual tokens for entropy analysis
 * @param {string} text - The text to tokenize
 * @returns {Array} Array of tokens with their positions
 */
function tokenizeText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const tokens = [];
  let currentToken = '';
  let startIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Consider whitespace and common punctuation as delimiters
    if (/\s|[.,;:!(){}[\]"'<>]/.test(char)) {
      if (currentToken.length > 0) {
        tokens.push({
          value: currentToken,
          index: startIndex
        });
        currentToken = '';
      }
    } else {
      if (currentToken.length === 0) {
        startIndex = i;
      }
      currentToken += char;
    }
  }

  // Add the last token if exists
  if (currentToken.length > 0) {
    tokens.push({
      value: currentToken,
      index: startIndex
    });
  }

  return tokens;
}

// UUID pattern — high entropy but never a secret
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tokens that are entirely hex digits (SHA hashes, serial numbers, etc.)
const ALL_HEX_PATTERN = /^[0-9a-f]+$/i;

/**
 * Returns true if the token is a known false-positive source that should
 * NOT be treated as a high-entropy secret even when the entropy score is high.
 */
function isFalsePositive(token) {
  // UUIDs — perfectly valid high-entropy strings that are never secrets
  if (UUID_PATTERN.test(token)) return true;

  // Base64 image data URIs embedded as env values (e.g. LOGO=data:image/png;base64,...)
  if (token.startsWith('data:image/') || token.startsWith('data:application/')) return true;

  // Very long tokens are almost always base64 blobs, not API keys
  if (token.length > 200) return true;

  // Pure hex strings (SHA-1/256 digests, fingerprints) — no mixed case means low key-space diversity
  if (ALL_HEX_PATTERN.test(token)) return true;

  return false;
}

/**
 * Checks if a token meets criteria for high entropy secret
 * @param {string} token - The token to check
 * @returns {boolean} True if token is likely a secret
 */
function isHighEntropySecret(token) {
  // Token length must be greater than 20
  if (token.length <= 20) {
    return false;
  }

  // Reject known false-positive patterns before paying the entropy cost
  if (isFalsePositive(token)) {
    return false;
  }

  // Calculate entropy
  const entropy = calculateEntropy(token);

  // Entropy must be greater than 4.5
  if (entropy <= 4.5) {
    return false;
  }

  // Must contain both letters and numbers
  const hasLetters = /[a-zA-Z]/.test(token);
  const hasNumbers = /[0-9]/.test(token);

  return hasLetters && hasNumbers;
}

/**
 * Scans text for high entropy secrets
 * @param {string} rawCode - The code/text to scan
 * @returns {Array} Array of detected high entropy secret objects
 */
// ADDED EXPORT HERE
export function scanWithEntropy(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') {
    return [];
  }

  const detections = [];
  const seenDetections = new Set();

  // Tokenize the text
  const tokens = tokenizeText(rawCode);

  // Analyze each token for high entropy
  for (const token of tokens) {
    if (isHighEntropySecret(token.value)) {
      const detectionKey = `${token.index}-${token.value}`;

      if (!seenDetections.has(detectionKey)) {
        seenDetections.add(detectionKey);

        detections.push({
          type: 'HIGH_ENTROPY_SECRET',
          value: token.value,
          index: token.index
        });
      }
    }
  }

  return detections;
}

/**
 * Utility function to get entropy statistics for a text
 * @param {string} text - The text to analyze
 * @returns {Object} Statistics about entropy in the text
 */
// ADDED EXPORT HERE
export function getEntropyStats(text) {
  if (!text || typeof text !== 'string') {
    return {
      averageEntropy: 0,
      maxEntropy: 0,
      highEntropyTokens: 0,
      totalTokens: 0
    };
  }

  const tokens = tokenizeText(text);
  const entropies = tokens.map(token => calculateEntropy(token.value));

  return {
    averageEntropy: entropies.length > 0 ? entropies.reduce((a, b) => a + b, 0) / entropies.length : 0,
    maxEntropy: entropies.length > 0 ? Math.max(...entropies) : 0,
    highEntropyTokens: entropies.filter(e => e > 4.5).length,
    totalTokens: tokens.length
  };
}