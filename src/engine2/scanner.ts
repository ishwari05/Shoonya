/**
 * CodeShield Scanner Module
 * Detects known secrets using regular expression patterns
 */

export interface SecretDetection {
    type: string;
    value: string;
    index: number;
}

export interface SecretPattern {
    pattern: RegExp;
    label: string;
    captureGroup?: number;
}

/**
 * Regex patterns for various secret types
 */
const SECRET_PATTERNS: Record<string, SecretPattern> = {
  AWS_ACCESS_KEY: {
    pattern: /\bAKIA[0-9A-Z]+\b/g,
    label: 'AWS_ACCESS_KEY'
  },
  AWS_SECRET_KEY: {
    pattern: /(?:aws_secret(?:_access)?_key|secret_access_key|secret_key|aws_secret)\s*[:=\s]\s*["']?([0-9a-zA-Z/+]{40})["']?/gi,
    label: 'AWS_SECRET_KEY',
    captureGroup: 1
  },
  OPENAI_API_KEY: {
    // High priority pattern - must match before generic patterns
    pattern: /\bsk-(?:[a-zA-Z0-9]{16,}|[a-zA-Z]+-[a-zA-Z0-9_-]{16,})\b/g,
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
    pattern: /Bearer\s+([a-zA-Z0-9\-._~+/]{20,}=*)/g,
    label: 'BEARER_TOKEN',
    captureGroup: 1
  },
  PRIVATE_KEY: {
    pattern: /-----BEGIN\s+(?:RSA |OPENSSH |EC |DSA |PGP |ENCRYPTED )?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA |OPENSSH |EC |DSA |PGP |ENCRYPTED )?PRIVATE\s+KEY-----/g,
    label: 'PRIVATE_KEY'
  },
  PASSWORD_ASSIGNMENT: {
    pattern: /(?:password|pwd)\s*[:=]\s*([^\s\n\r"']+)/gi,
    label: 'PASSWORD_ASSIGNMENT',
    captureGroup: 1
  },
  // 2. NEW: Semantic Context Detection
  SEMANTIC_PASSWORD: {
    // Lower priority - only matches if not caught by specific patterns above
    pattern: /(?:password|secret|pwd|jwtSecret|initialPassword|credential)\s*[:=]\s*['"]([^'"]{8,})['"](?!\s*\.)/gi,
    label: 'SEMANTIC_PASSWORD'
  },

  // 3. PII Detection
  PHONE_NUMBER: {
    // Matches real phone numbers: +1 (415) 555-0192, 800-867-5309, +91-98765-43210
    // Simplified pattern for TypeScript compatibility
    pattern: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    label: 'PHONE_NUMBER'
  },

  // 4. .env / config file bulk detection
  // Catches lines like: SECRET_KEY=abc123... or API_TOKEN="abc123..."
  ENV_VARIABLE: {
    pattern: /^([A-Z][A-Z0-9_]{2,})\s*=\s*["']?([^\s"'\n\r]{16,})["']?$/gm,
    label: 'ENV_VARIABLE',
    captureGroup: 2  // We only want to redact the VALUE, not the key name
  },

  // 5. New provider tokens
  GITHUB_PAT: {
    // Covers classic (ghp_), fine-grained (github_pat_), and refresh (ghr_) tokens
    pattern: /(?:ghp_|github_pat_|ghr_)[a-zA-Z0-9]{22,}/g,
    label: 'GITHUB_PAT'
  }
};

/**
 * Scan text using regex patterns
 * @param text The text to scan
 * @returns Array of detected secrets
 */
export function scanWithRegex(text: string): SecretDetection[] {
  const detections: SecretDetection[] = [];

  for (const [name, config] of Object.entries(SECRET_PATTERNS)) {
    const matches = text.match(config.pattern);
    if (matches) {
      if (config.captureGroup !== undefined) {
        // For patterns with capture groups, use the captured group
        for (let i = 1; i < matches.length; i++) {
          const match = matches[i];
          const secret = {
            type: config.label,
            value: match[config.captureGroup],
            index: text.indexOf(match)
          };
          detections.push(secret);
        }
      } else {
        // For patterns without capture groups, use the full match
        for (let i = 1; i < matches.length; i++) {
          const match = matches[i];
          const secret = {
            type: config.label,
            value: match,
            index: text.indexOf(match)
          };
          detections.push(secret);
        }
      }
    }
  }

  return detections;
}

export { SECRET_PATTERNS };
