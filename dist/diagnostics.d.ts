/**
 * CodeShield Diagnostics
 * Integrates with VS Code Problems panel to show detected secrets
 */
import * as vscode from 'vscode';
import { SecretDetection } from './engine-wrapper';
export declare class DiagnosticProvider {
    private diagnosticCollection;
    private outputChannel;
    constructor();
    /**
     * Update diagnostics for a document
     * @param document The document to update diagnostics for
     * @param secrets Array of detected secrets
     */
    updateDiagnostics(document: vscode.TextDocument, secrets: SecretDetection[]): void;
    /**
     * Clear diagnostics for a document
     * @param document The document to clear diagnostics for
     */
    clearDiagnostics(document: vscode.TextDocument): void;
    /**
     * Clear all diagnostics
     */
    clearAllDiagnostics(): void;
    /**
     * Get diagnostic message for a secret
     * @param secret The secret detection
     * @returns Diagnostic message
     */
    private getDiagnosticMessage;
    /**
     * Get diagnostic severity based on secret type
     * @param type The secret type
     * @returns Diagnostic severity
     */
    private getDiagnosticSeverity;
    /**
     * Add code actions to diagnostic
     * @param diagnostic The diagnostic to add actions to
     * @param secret The secret detection
     */
    private addCodeActions;
    /**
     * Get all diagnostics for a workspace
     * @returns Array of all diagnostics
     */
    getAllDiagnostics(): [vscode.Uri, readonly vscode.Diagnostic[]][];
    /**
     * Get statistics about detected secrets
     * @returns Statistics object
     */
    getDiagnosticStats(): {
        totalSecrets: number;
        filesWithSecrets: number;
        secretsByType: Record<string, number>;
    };
    /**
     * Show diagnostic statistics
     */
    showDiagnosticStats(): void;
    /**
     * Dispose of resources
     */
    dispose(): void;
}
//# sourceMappingURL=diagnostics.d.ts.map