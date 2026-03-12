/**
 * CodeShield Decorator
 * Handles highlighting secrets in the VS Code editor
 */
import * as vscode from 'vscode';
import { SecretDetection } from './engine-wrapper';
export declare class SecretDecorator {
    private decorationType;
    private statusBar;
    private outputChannel;
    constructor();
    /**
     * Update decorations in the active editor
     * @param secrets Array of detected secrets
     */
    updateDecorations(secrets: SecretDetection[]): void;
    /**
     * Clear all decorations
     */
    clearDecorations(): void;
    /**
     * Update status bar with secret count
     * @param count Number of secrets detected
     */
    private updateStatusBar;
    /**
     * Format secret type for display
     * @param type The secret type
     * @returns Formatted display string
     */
    private formatSecretType;
    /**
     * Show notification for detected secrets
     * @param secrets Array of detected secrets
     * @param document The document where secrets were found
     */
    showSecretNotification(secrets: SecretDetection[], document: vscode.TextDocument): void;
    /**
     * Get risk level from secrets
     * @param secrets Array of detected secrets
     * @returns Risk level string
     */
    private getRiskLevel;
    /**
     * Dispose of resources
     */
    dispose(): void;
}
//# sourceMappingURL=decorator.d.ts.map