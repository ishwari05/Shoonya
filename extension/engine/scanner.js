/**
 * CodeShield Scanner Module
 * Detects known secrets using regular expression patterns
 */

/**
 * Regex patterns for various secret types
 */
const SECRET_PATTERNS = {
  // 1. FIXED: Added \b (word boundaries) and + (greedy match) to prevent partial leaks
  AWS_ACCESS_KEY: {
    pattern: /\bAKIA[0-9A-Z]+\b/g,
    label: 'AWS_ACCESS_KEY'
  },
  AWS_SECRET_KEY: {
    // Requires a keyword prefix (AWS_SECRET, secret_key, etc.) before the 40-char value.
    // This avoids false positives on normal text while catching real-world key formats.
    pattern: /(?:aws_secret(?:_access)?_key|secret_access_key|secret_key|aws_secret)\s*[:=\s]\s*["']?([0-9a-zA-Z/+]{40})["']?/gi,
    label: 'AWS_SECRET_KEY'
  },
  OPENAI_API_KEY: {
    // Matches legacy sk-<20+alnum> AND newer sk-proj-<token>, sk-svcacct-<token> etc.
    // Minimum lowered to 20 so keys slightly under 48 chars are still caught by regex
    // rather than falling through to the entropy scanner with a generic label.
    pattern: /\bsk-(?:[a-zA-Z0-9]{20,}|[a-zA-Z]+-[a-zA-Z0-9_-]{20,})\b/g,
    label: 'OPENAI_API_KEY'
  },
  STRIPE_LIVE_KEY: {
    pattern: /\bsk_live_[a-zA-Z0-9]{24,}\b/g,
    label: 'STRIPE_LIVE_KEY'
  },
  STRIPE_TEST_KEY: {
    pattern: /\bsk_test_[a-zA-Z0-9]{24,}\b/g,
    label: 'STRIPE_TEST_KEY'
  },
  GOOGLE_API_KEY: {
    pattern: /\bAIza[0-9A-Za-z_-]{35,}\b/g,
    label: 'GOOGLE_API_KEY'
  },
  JWT_TOKEN: {
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    label: 'JWT_TOKEN'
  },
  BEARER_TOKEN: {
    pattern: /Bearer\s+([a-zA-Z0-9\-._~+/]+=*)/g, // Added capture group
    label: 'BEARER_TOKEN'
  },
  PRIVATE_KEY: {
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    label: 'PRIVATE_KEY'
  },
  PASSWORD_ASSIGNMENT: {
    pattern: /(?:password|pwd)\s*[:=]\s*([^\s\n\r"']+)/gi, // Added capture group
    label: 'PASSWORD_ASSIGNMENT'
  },

  // 2. NEW: Semantic Context Detection
  SEMANTIC_PASSWORD: {
    // Looks for trigger words, then captures the string inside quotes
    pattern: /(?:password|secret|pwd)[^'"]*['"]([^'"]+)['"]/gi,
    label: 'SEMANTIC_PASSWORD'
  },

  // 3. PII Detection
  PHONE_NUMBER: {
    // Handles +1 (415) 555-0192, 800-867-5309, +91-98765-43210 etc.
    // Note: UUID segments are filtered out via the post-filter in scanWithRegex below.
    pattern: /(?:\+\d{1,3}[-\s]?)?(?:\(?\d{2,5}\)?[-\s]?)(?:\d{3,5}[-\s]?){1,2}\d{4,5}(?=\s|$|[^\d])/g,
    label: 'PHONE_NUMBER'
  },

  // 4. .env / config file bulk detection
  // Catches lines like: SECRET_KEY=abc123... or API_TOKEN="abc123..."
  // Only fires when value is ≥16 chars (avoids matching short IDs / port numbers)
  ENV_VARIABLE: {
    pattern: /^([A-Z][A-Z0-9_]{2,})\s*=\s*["']?([^\s"'\n\r]{16,})["']?$/gm,
    label: 'ENV_VARIABLE',
    captureGroup: 2  // We only want to redact the VALUE, not the key name
  },

  // 5. New provider tokens
  GITHUB_PAT: {
    pattern: /\bghp_[a-zA-Z0-9]{36}\b/g,
    label: 'GITHUB_PAT'
  },
  SLACK_TOKEN: {
    pattern: /\bxox[bpars]-[0-9A-Za-z-]{10,}\b/g,
    label: 'SLACK_TOKEN'
  },
  HUGGINGFACE_TOKEN: {
    pattern: /\bhf_[a-zA-Z0-9]{20,}\b/g,
    label: 'HUGGINGFACE_TOKEN'
  }
};

/**
 * Scans text for known secrets using regex patterns
 * @param {string} rawCode - The code/text to scan
 * @returns {Array} Array of detected secret objects
 */
export function scanWithRegex(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') {
    return [];
  }

  // Build a set of UUID ranges so we can skip matches that fall inside a UUID.
  // UUID format: 8-4-4-4-12 hex digits separated by dashes.
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const uuidRanges = [];
  let uuidMatch;
  while ((uuidMatch = UUID_RE.exec(rawCode)) !== null) {
    uuidRanges.push([uuidMatch.index, uuidMatch.index + uuidMatch[0].length]);
  }

  function isInsideUUID(start, end) {
    return uuidRanges.some(([us, ue]) => start >= us && end <= ue);
  }

  const detections = [];
  const seenDetections = new Set();

  for (const [type, config] of Object.entries(SECRET_PATTERNS)) {
    let match;
    config.pattern.lastIndex = 0;

    while ((match = config.pattern.exec(rawCode)) !== null) {
      // Support explicit captureGroup index (e.g. ENV_VARIABLE uses group 2 for the value)
      const groupIndex = config.captureGroup !== undefined ? config.captureGroup : (match[1] !== undefined ? 1 : 0);
      const matchedValue = match[groupIndex] !== undefined ? match[groupIndex] : match[0];

      // Calculate the exact starting index so the redactor slices accurately
      const startIndex = groupIndex > 0 && match[groupIndex] !== undefined
        ? match.index + match[0].indexOf(match[groupIndex])
        : match.index;

      const detectionKey = `${startIndex}-${matchedValue}`;

      if (!seenDetections.has(detectionKey)) {
        seenDetections.add(detectionKey);

        // Skip detections that fall entirely within a UUID (e.g. phone-pattern matching UUID segments)
        if (isInsideUUID(startIndex, startIndex + matchedValue.length)) {
          if (match.index === config.pattern.lastIndex) config.pattern.lastIndex++;
          continue;
        }

        detections.push({
          type: config.label,
          value: matchedValue,
          index: startIndex
        });
      }

      if (match.index === config.pattern.lastIndex) {
        config.pattern.lastIndex++;
      }
    }
  }

  return detections;
}

/**
 * Get all available secret patterns
 * @returns {Object} Object containing all secret patterns
 */
export function getSecretPatterns() {
  return SECRET_PATTERNS;
}