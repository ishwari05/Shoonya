/**
 * redactor.js
 * Responsibility: Transform raw code into safe code using placeholders.
 */

/**
 * Replaces detected secrets with placeholders in a way that preserves 
 * string integrity and handles duplicate values.
 * @param {string} rawCode - The original text from the user.
 * @param {Array} secretsFound - Array of objects { type, value, index }.
 * @returns {Object} { redactedCode: string, mapping: object }
 */
// Added 'export' so index.js can see this
export function redactCode(rawCode, secretsFound) {
    // 1. Guard Clause: If no secrets, return original
    if (!secretsFound || secretsFound.length === 0) {
        return { redactedCode: rawCode, mapping: {} };
    }

    // 2. Setup tracking for placeholders
    const mapping = {};        // { "[OPENAI_1]": "sk-..." }
    const typeCounters = {};   // { "OPENAI": 1 }
    const valueToPlaceholder = new Map(); // Tracks if we've seen this specific secret string before
    let redactedCode = rawCode;

    // 3. CRITICAL: Sort by index DESCENDING (Bottom-to-Top)
    // Replacing from the end keeps all earlier indices stable.
    const sortedSecrets = [...secretsFound].sort((a, b) => b.index - a.index);

    // Track replaced regions so overlapping detections are skipped.
    // e.g. JWT regex captures the full token at index X; entropy also captures
    // a segment starting inside that same region — we must skip the second one.
    const usedRegions = [];

    sortedSecrets.forEach(secret => {
        const { type, value, index } = secret;
        const end = index + value.length;

        // Skip if this detection overlaps any already-replaced region
        const overlaps = usedRegions.some(r => index < r.end && end > r.start);
        if (overlaps) return;
        usedRegions.push({ start: index, end });

        let placeholder;

        // Handle Duplicate Secrets — same value → same placeholder name
        if (valueToPlaceholder.has(value)) {
            placeholder = valueToPlaceholder.get(value);
        } else {
            typeCounters[type] = (typeCounters[type] || 0) + 1;
            placeholder = `[${type}_${typeCounters[type]}]`;
            valueToPlaceholder.set(value, placeholder);
            mapping[placeholder] = value;
        }

        // Surgical String Slicing — replace only the detected secret
        redactedCode =
            redactedCode.slice(0, index) +
            placeholder +
            redactedCode.slice(index + value.length);
    });

    return { redactedCode, mapping };
};

/**
 * Reverses the process. Used when the AI responds with placeholders.
 * @param {string} aiOutput - The text received from the AI tool.
 * @param {Object} mapping - The mapping object created during redaction.
 * @returns {string} - The text with original secrets restored.
 */
// Added 'export' for future use
export function restoreCode(aiOutput, mapping) {
    let restored = aiOutput;

    // Sort placeholders by length DESCENDING.
    // This prevents a bug where "[KEY_1]" might accidentally 
    // partially replace inside "[KEY_10]".
    const placeholders = Object.keys(mapping).sort((a, b) => b.length - a.length);

    placeholders.forEach(placeholder => {
        // Use split/join for a global "replace all" without regex escaping issues
        restored = restored.split(placeholder).join(mapping[placeholder]);
    });

    return restored;
};