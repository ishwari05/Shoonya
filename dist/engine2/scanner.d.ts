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
declare const SECRET_PATTERNS: Record<string, SecretPattern>;
/**
 * Scan text using regex patterns
 * @param text The text to scan
 * @returns Array of detected secrets
 */
export declare function scanWithRegex(text: string): SecretDetection[];
export { SECRET_PATTERNS };
//# sourceMappingURL=scanner.d.ts.map