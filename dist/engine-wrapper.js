"use strict";
/**
 * CodeShield Engine Wrapper
 * TypeScript wrapper for existing JavaScript detection engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeShieldEngine = void 0;
// Clear all relevant module caches to ensure fresh engine loading
const enginePath = require.resolve('./engine/index.js');
delete require.cache[enginePath];
delete require.cache[require.resolve('./engine/scanner.js')];
delete require.cache[require.resolve('./engine/redactor.js')];
delete require.cache[require.resolve('./engine/entropy.js')];
const engine = require('./engine/index.js');
const processCode = engine.processCode;
const quickScan = engine.quickScan;
const getCodeStats = engine.getCodeStats;
/**
 * Wrapper class for CodeShield engine functionality
 */
class CodeShieldEngine {
    /**
     * Process text and detect/redact secrets
     * @param text The text to process
     * @returns ProcessResult with detected secrets and redacted content
     */
    static processText(text) {
        try {
            return processCode(text);
        }
        catch (error) {
            console.error('CodeShield engine error:', error);
            return {
                secretsFound: [],
                redactedCode: text,
                mapping: {},
                metadata: {
                    totalLength: text.length,
                    processingTime: 0,
                    scanCount: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
    /**
     * Quick scan for secrets without redaction
     * @param text The text to scan
     * @returns Array of detected secrets
     */
    static quickScan(text) {
        try {
            return quickScan(text);
        }
        catch (error) {
            console.error('CodeShield quick scan error:', error);
            return [];
        }
    }
    /**
     * Get statistics about the code
     * @param text The text to analyze
     * @returns CodeStats with risk assessment
     */
    static getCodeStats(text) {
        try {
            return getCodeStats(text);
        }
        catch (error) {
            console.error('CodeShield stats error:', error);
            return {
                lineCount: text.split('\n').length,
                characterCount: text.length,
                wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
                estimatedRisk: 'none',
                secretCount: 0
            };
        }
    }
    /**
     * Check if a file should be excluded from scanning
     * @param fileName The file name to check
     * @param excludedPatterns Array of exclusion patterns
     * @returns True if file should be excluded
     */
    static shouldExcludeFile(fileName, excludedPatterns) {
        const fileNameLower = fileName.toLowerCase();
        return excludedPatterns.some(pattern => {
            const patternLower = pattern.toLowerCase();
            if (pattern.includes('*')) {
                // Convert glob pattern to regex
                const regexPattern = patternLower
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                return new RegExp(regexPattern).test(fileNameLower);
            }
            return fileNameLower.includes(patternLower);
        });
    }
    /**
     * Get risk level from detected secrets
     * @param secrets Array of detected secrets
     * @returns Risk level string
     */
    static getRiskLevel(secrets) {
        if (secrets.length === 0)
            return 'none';
        const highRiskTypes = [
            'AWS_ACCESS_KEY',
            'AWS_SECRET_KEY',
            'OPENAI_API_KEY',
            'PRIVATE_KEY',
            'GITHUB_PAT',
            'GOOGLE_API_KEY'
        ];
        const hasHighRisk = secrets.some(secret => highRiskTypes.includes(secret.type));
        if (hasHighRisk)
            return 'high';
        if (secrets.length > 3)
            return 'medium';
        return 'low';
    }
    /**
     * Format secret type for display
     * @param type The secret type
     * @returns Formatted display string
     */
    static formatSecretType(type) {
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
}
exports.CodeShieldEngine = CodeShieldEngine;
//# sourceMappingURL=engine-wrapper.js.map