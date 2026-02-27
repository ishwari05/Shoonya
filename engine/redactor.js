/**
 * redactor.js
 * Responsibility: Transform raw code into safe code using placeholders.
 */

/**
 * Replaces detected secrets with placeholders in a way that preserves 
 * string integrity and handles duplicate values.
 * * @param {string} rawCode - The original text from the user.
 * @param {Array} secretsFound - Array of objects { type, value, index }.
 * @returns {Object} { redactedCode: string, mapping: object }
 */
export const redactCode = (rawCode, secretsFound) => {
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
    // If we replace a 20-char secret with an 8-char placeholder at the start,
    // all subsequent secret indices would become mathematically incorrect.
    // By starting from the end, the indices at the beginning remain stable.
    const sortedSecrets = [...secretsFound].sort((a, b) => b.index - a.index);

    sortedSecrets.forEach(secret => {
        const { type, value, index } = secret;
        let placeholder;

        // 4. Handle Duplicate Secrets
        // Requirement: Same secret value = Same placeholder name
        if (valueToPlaceholder.has(value)) {
            placeholder = valueToPlaceholder.get(value);
        } else {
            typeCounters[type] = (typeCounters[type] || 0) + 1;
            placeholder = `[${type}_${typeCounters[type]}]`;
            
            valueToPlaceholder.set(value, placeholder);
            mapping[placeholder] = value;
        }

        // 5. Surgical String Slicing
        // We cut the string at the exact index and "stitch" in the placeholder.
        redactedCode = 
            redactedCode.slice(0, index) + 
            placeholder + 
            redactedCode.slice(index + value.length);
    });

    return { redactedCode, mapping };
};

/**
 * Reverses the process. Used when the AI responds with placeholders.
 * * @param {string} aiOutput - The text received from the AI tool.
 * @param {Object} mapping - The mapping object created during redaction.
 * @returns {string} - The text with original secrets restored.
 */
export const restoreCode = (aiOutput, mapping) => {
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