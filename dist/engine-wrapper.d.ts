/**
 * CodeShield Engine Wrapper
 * TypeScript wrapper for existing JavaScript detection engine
 */
export interface SecretDetection {
    type: string;
    value: string;
    index: number;
}
export interface ProcessResult {
    secretsFound: SecretDetection[];
    redactedCode: string;
    mapping: Record<string, string>;
    metadata: {
        totalLength: number;
        processingTime: number;
        scanCount: number;
        regexMatches?: number;
        entropyMatches?: number;
        processingMode?: string;
        error?: string;
    };
}
export interface CodeStats {
    lineCount: number;
    characterCount: number;
    wordCount: number;
    estimatedRisk: 'none' | 'low' | 'medium' | 'high';
    secretCount: number;
}
/**
 * Wrapper class for CodeShield engine functionality
 */
export declare class CodeShieldEngine {
    /**
     * Process text and detect/redact secrets
     * @param text The text to process
     * @returns ProcessResult with detected secrets and redacted content
     */
    static processText(text: string): ProcessResult;
    /**
     * Quick scan for secrets without redaction
     * @param text The text to scan
     * @returns Array of detected secrets
     */
    static quickScan(text: string): SecretDetection[];
    /**
     * Get statistics about the code
     * @param text The text to analyze
     * @returns CodeStats with risk assessment
     */
    static getCodeStats(text: string): CodeStats;
    /**
     * Check if a file should be excluded from scanning
     * @param fileName The file name to check
     * @param excludedPatterns Array of exclusion patterns
     * @returns True if file should be excluded
     */
    static shouldExcludeFile(fileName: string, excludedPatterns: string[]): boolean;
    /**
     * Get risk level from detected secrets
     * @param secrets Array of detected secrets
     * @returns Risk level string
     */
    static getRiskLevel(secrets: SecretDetection[]): 'none' | 'low' | 'medium' | 'high';
    /**
     * Format secret type for display
     * @param type The secret type
     * @returns Formatted display string
     */
    static formatSecretType(type: string): string;
}
//# sourceMappingURL=engine-wrapper.d.ts.map