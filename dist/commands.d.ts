/**
 * CodeShield Commands
 * Implements VS Code commands for secret management
 */
import * as vscode from 'vscode';
import { SecretDecorator } from './decorator';
import { DiagnosticProvider } from './diagnostics';
export declare class CommandHandler {
    private decorator;
    private diagnosticProvider;
    private ignoredSecrets;
    private safeList;
    constructor(decorator: SecretDecorator, diagnosticProvider: DiagnosticProvider);
    /**
     * Register all CodeShield commands
     */
    registerCommands(): vscode.Disposable[];
    /**
     * Redact all secrets in the active document
     */
    redactSecrets(): Promise<void>;
    /**
     * Quick redaction without confirmation
     */
    quickRedact(): Promise<void>;
    /**
     * Scan the active document for secrets
     */
    scanDocument(document?: vscode.TextDocument): Promise<void>;
    /**
     * Ignore a specific secret
     */
    private ignoreSecret;
    /**
     * Add a secret to the safe list
     */
    private addToSafeList;
    /**
     * Show statistics about detected secrets
     */
    private showStats;
    /**
     * Clear all ignored secrets
     */
    private clearIgnored;
    /**
     * Clear the safe list
     */
    private clearSafeList;
    /**
     * Check if a secret is ignored
     */
    private isIgnored;
    /**
     * Check if a secret is safe-listed
     */
    private isSafeListed;
    /**
     * Get count for secret type (for placeholder numbering)
     */
    private getSecretCount;
    /**
     * Filter overlapping ranges to prevent VS Code edit conflicts
     */
    private filterOverlappingRanges;
    /**
     * Show React-style popup notification after detection
     */
    private showDetectionPopup;
    /**
     * Get risk level based on secret count
     */
    private getRiskLevel;
    /**
     * Show detailed secret information
     */
    private showSecretDetails;
}
//# sourceMappingURL=commands.d.ts.map