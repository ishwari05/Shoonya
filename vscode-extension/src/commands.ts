/**
 * Shoonya Commands
 * Implements VS Code commands for secret management
 */

import * as vscode from 'vscode';
import { ShoonyaEngine, SecretDetection, ProcessResult } from './engine-wrapper';
import { SecretDecorator } from './decorator';
import { DiagnosticProvider } from './diagnostics';

export class CommandHandler {
    private decorator: SecretDecorator;
    private diagnosticProvider: DiagnosticProvider;
    private ignoredSecrets: Set<string> = new Set();
    private safeList: Set<string> = new Set();

    constructor(decorator: SecretDecorator, diagnosticProvider: DiagnosticProvider) {
        this.decorator = decorator;
        this.diagnosticProvider = diagnosticProvider;
    }

    /**
     * Register all Shoonya commands
     */
    public registerCommands(): vscode.Disposable[] {
        const commands = [
            vscode.commands.registerCommand('shoonya.redactSecrets', () => this.redactSecrets()),
            vscode.commands.registerCommand('shoonya.scanDocument', () => this.scanDocument()),
            vscode.commands.registerCommand('shoonya.quickRedact', () => this.quickRedact()),
            vscode.commands.registerCommand('shoonya.ignoreSecret', (secret: SecretDetection) => this.ignoreSecret(secret)),
            vscode.commands.registerCommand('shoonya.addToSafeList', (secret: SecretDetection) => this.addToSafeList(secret)),
            vscode.commands.registerCommand('shoonya.showStats', () => this.showStats()),
            vscode.commands.registerCommand('shoonya.clearIgnored', () => this.clearIgnored()),
            vscode.commands.registerCommand('shoonya.clearSafeList', () => this.clearSafeList())
        ];
        return commands;
    }

    /**
     * Redact all secrets in the active document
     */
    public async redactSecrets(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = activeEditor.document;
        const text = document.getText();

        if (!text) {
            vscode.window.showInformationMessage('No text to scan');
            return;
        }

        try {
            // Process text with engine
            const result = ShoonyaEngine.processText(text);
            
            if (result.secretsFound.length === 0) {
                vscode.window.showInformationMessage('No secrets found to redact');
                return;
            }

            // Filter out ignored secrets and safe-listed secrets
            const secretsToRedact = result.secretsFound.filter(secret => 
                !this.isIgnored(secret) && !this.isSafeListed(secret)
            );

            if (secretsToRedact.length === 0) {
                vscode.window.showInformationMessage('All detected secrets are ignored or safe-listed');
                return;
            }

            // Confirm redaction
            const confirmMessage = `Redact ${secretsToRedact.length} secret${secretsToRedact.length > 1 ? 's' : ''}? This action can be undone with Ctrl+Z.`;
            const action = await vscode.window.showWarningMessage(confirmMessage, 'Redact', 'Cancel');
            
            if (action !== 'Redact') {
                return;
            }

            // Apply redaction using WorkspaceEdit for atomic operations
            const nonOverlappingSecrets = this.filterOverlappingRanges(secretsToRedact);
            console.log('🔧 Redacting', nonOverlappingSecrets.length, 'secrets');
            
            if (nonOverlappingSecrets.length === 0) {
                vscode.window.showInformationMessage('All detected secrets are overlapping or already redacted');
                return;
            }

            // Create workspace edit for atomic operation
            const edit = new vscode.WorkspaceEdit();
            const documentUri = document.uri;

            // Sort secrets by start position (descending) to avoid index shifts
            const sortedSecrets = nonOverlappingSecrets
                .sort((a, b) => b.index - a.index);

            // Apply edits in order
            for (const secret of sortedSecrets) {
                const placeholder = `[${secret.type}_${this.getSecretCount(secret.type, nonOverlappingSecrets)}]`;
                const range = new vscode.Range(
                    document.positionAt(secret.index),
                    document.positionAt(secret.index + secret.value.length)
                );
                
                console.log('🔧 Replacing', secret.type, 'with', placeholder);
                edit.replace(documentUri, range, placeholder);
            }

            // Apply all edits atomically
            const success = await vscode.workspace.applyEdit(edit);
            console.log('🔧 Edit applied:', success);

            vscode.window.showInformationMessage(
                `✅ Redacted ${nonOverlappingSecrets.length} secret${nonOverlappingSecrets.length > 1 ? 's' : ''} (Press Ctrl+Z to undo)`
            );

            // Clear decorations after redaction
            this.decorator.clearDecorations();
            this.diagnosticProvider.clearDiagnostics(document);

        } catch (error) {
            vscode.window.showErrorMessage(`Error redacting secrets: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Quick redaction without confirmation
     */
    public async quickRedact(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = activeEditor.document;
        try {
            const result = ShoonyaEngine.processText(document.getText());
            
            if (result.secretsFound.length === 0) {
                vscode.window.showInformationMessage('No secrets found to redact');
                return;
            }

            // Filter out ignored secrets and safe-listed secrets
            const secretsToRedact = result.secretsFound.filter(secret => 
                !this.isIgnored(secret) && !this.isSafeListed(secret)
            );

            if (secretsToRedact.length === 0) {
                vscode.window.showInformationMessage('All detected secrets are ignored or safe-listed');
                return;
            }

            // Apply redaction immediately without confirmation
            const nonOverlappingSecrets = this.filterOverlappingRanges(secretsToRedact);
            console.log('🔧 Quick redacting', nonOverlappingSecrets.length, 'secrets');
            
            if (nonOverlappingSecrets.length === 0) {
                vscode.window.showInformationMessage('All detected secrets are overlapping or already redacted');
                return;
            }

            // Create workspace edit for atomic operation
            const edit = new vscode.WorkspaceEdit();
            const documentUri = document.uri;

            // Sort secrets by start position (descending) to avoid index shifts
            const sortedSecrets = nonOverlappingSecrets
                .sort((a, b) => b.index - a.index);

            // Apply edits in order
            for (const secret of sortedSecrets) {
                const placeholder = `[${secret.type}_${this.getSecretCount(secret.type, nonOverlappingSecrets)}]`;
                const range = new vscode.Range(
                    document.positionAt(secret.index),
                    document.positionAt(secret.index + secret.value.length)
                );
                
                console.log('🔧 Replacing', secret.type, 'with', placeholder);
                edit.replace(documentUri, range, placeholder);
            }

            // Apply all edits atomically
            const success = await vscode.workspace.applyEdit(edit);
            console.log('🔧 Edit applied:', success);

            vscode.window.showInformationMessage(
                `⚡ Quick redacted ${nonOverlappingSecrets.length} secret${nonOverlappingSecrets.length > 1 ? 's' : ''} (Press Ctrl+Z to undo)`
            );

            // Clear decorations after redaction
            this.decorator.clearDecorations();
            this.diagnosticProvider.clearDiagnostics(document);

        } catch (error) {
            console.error('❌ Quick redaction error:', error);
            vscode.window.showErrorMessage(`Quick redaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Scan the active document for secrets
     */
    public async scanDocument(document?: vscode.TextDocument): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const docToScan = document || activeEditor?.document;
        if (!docToScan) {
            vscode.window.showInformationMessage('No text to scan');
            return;
        }

        try {
            const text = docToScan.getText();
            console.log('🔍 Scanning document with', text.length, 'characters');
            
            const result = ShoonyaEngine.processText(text);
            console.log('🔍 Found', result.secretsFound.length, 'secrets');
            
            if (result.secretsFound.length === 0) {
                vscode.window.showInformationMessage('No secrets found in document');
                return;
            }

            // Show popup notification
            if (docToScan) {
                this.showDetectionPopup(result.secretsFound.length, docToScan);
            }

            // Update decorations and diagnostics
            this.decorator.updateDecorations(result.secretsFound);
            this.diagnosticProvider.updateDiagnostics(docToScan, result.secretsFound);

            vscode.window.showInformationMessage(
                `Found ${result.secretsFound.length} secret${result.secretsFound.length > 1 ? 's' : ''} in document`
            );

        } catch (error) {
            console.error('❌ Scan error:', error);
            vscode.window.showErrorMessage(`Error scanning document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ignore a specific secret
     */
    private async ignoreSecret(secret: SecretDetection): Promise<void> {
        this.ignoredSecrets.add(`${secret.type}-${secret.value}`);
        vscode.window.showInformationMessage(`Secret ignored: ${secret.type}`);
        
        // Refresh current document
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.scanDocument(activeEditor.document);
        }
    }

    /**
     * Add a secret to the safe list
     */
    private async addToSafeList(secret: SecretDetection): Promise<void> {
        this.safeList.add(`${secret.type}-${secret.value}`);
        vscode.window.showInformationMessage(`Secret added to safe list: ${secret.type}`);
        
        // Refresh current document
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.scanDocument(activeEditor.document);
        }
    }

    /**
     * Show statistics about detected secrets
     */
    private async showStats(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = activeEditor.document;
        const text = document.getText();

        if (!text) {
            vscode.window.showInformationMessage('No text to analyze');
            return;
        }

        try {
            const stats = ShoonyaEngine.getCodeStats(text);
            const result = ShoonyaEngine.processText(text);
            
            const message = `
📊 Shoonya Statistics

🔍 Detection Results:
   • Total Secrets Found: ${result.secretsFound.length}
   • Risk Level: ${stats.estimatedRisk.toUpperCase()}
   • Document Length: ${stats.characterCount} characters

🛡️ Protection Status:
   • Ignored Secrets: ${this.ignoredSecrets.size}
   • Safe Listed Secrets: ${this.safeList.size}

⚡ Performance:
   • Processing Time: ${result.metadata.processingTime}ms
   • Lines Scanned: ${stats.lineCount}
            `.trim();

            vscode.window.showInformationMessage(message, 'View Details');

        } catch (error) {
            vscode.window.showErrorMessage(`Error showing statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clear all ignored secrets
     */
    private async clearIgnored(): Promise<void> {
        this.ignoredSecrets.clear();
        vscode.window.showInformationMessage('Cleared all ignored secrets');
        
        // Refresh current document
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.scanDocument(activeEditor.document);
        }
    }

    /**
     * Clear the safe list
     */
    private async clearSafeList(): Promise<void> {
        this.safeList.clear();
        vscode.window.showInformationMessage('Cleared safe list');
        
        // Refresh current document
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.scanDocument(activeEditor.document);
        }
    }

    /**
     * Check if a secret is ignored
     */
    private isIgnored(secret: SecretDetection): boolean {
        return this.ignoredSecrets.has(`${secret.type}-${secret.value}`);
    }

    /**
     * Check if a secret is safe-listed
     */
    private isSafeListed(secret: SecretDetection): boolean {
        return this.safeList.has(`${secret.type}-${secret.value}`);
    }

    /**
     * Get count for secret type (for placeholder numbering)
     */
    private getSecretCount(type: string, secrets: SecretDetection[]): number {
        return secrets.filter(s => s.type === type).length;
    }

    /**
     * Filter overlapping ranges to prevent VS Code edit conflicts
     */
    private filterOverlappingRanges(secrets: SecretDetection[]): SecretDetection[] {
        if (!secrets || secrets.length <= 1) {
            return secrets;
        }

        // Sort by start index
        const sortedSecrets = [...secrets].sort((a, b) => a.index - b.index);
        
        // Filter out overlapping ranges - keep the longest range when overlaps occur
        const filteredSecrets: SecretDetection[] = [];
        for (let i = 0; i < sortedSecrets.length; i++) {
            const current = sortedSecrets[i];
            const end = current.index + current.value.length;
            
            // Check if current overlaps with any previously added secret
            const overlaps = filteredSecrets.some(prev => {
                const prevEnd = prev.index + prev.value.length;
                return current.index < prevEnd && end > prev.index;
            });
            
            if (!overlaps) {
                filteredSecrets.push(current);
            } else {
                // If overlapping, check if current is longer than the previous one
                const overlappingIndex = filteredSecrets.findIndex(prev => {
                    const prevEnd = prev.index + prev.value.length;
                    return current.index < prevEnd && end > prev.index;
                });
                
                if (overlappingIndex !== -1) {
                    const prev = filteredSecrets[overlappingIndex];
                    // Replace with longer secret
                    if (current.value.length > prev.value.length) {
                        filteredSecrets[overlappingIndex] = current;
                    }
                }
            }
        }
        
        return filteredSecrets;
    }

    /**
     * Show React-style popup notification after detection
     */
    private showDetectionPopup(secretCount: number, document: vscode.TextDocument): void {
        const fileName = document.fileName.split('/').pop() || document.fileName;
        
        // Show popup with actions
        const actions = ['Redact', 'Quick Redact', 'View Details'];
        vscode.window.showInformationMessage(
            `🛡️ Found ${secretCount} secret${secretCount > 1 ? 's' : ''} in ${fileName}`,
            ...actions
        ).then(action => {
            switch (action) {
                case 'Redact':
                    this.redactSecrets();
                    break;
                case 'Quick Redact':
                    this.quickRedact();
                    break;
                case 'View Details':
                    this.showSecretDetails(document);
                    break;
            }
        });
    }

    /**
     * Get risk level based on secret count
     */
    private getRiskLevel(secretCount: number): string {
        if (secretCount >= 5) return '🔴 HIGH';
        if (secretCount >= 2) return '🟡 MEDIUM';
        return '🟢 LOW';
    }

    /**
     * Show detailed secret information
     */
    private async showSecretDetails(document: vscode.TextDocument): Promise<void> {
        const result = ShoonyaEngine.processText(document.getText());
        
        if (result.secretsFound.length === 0) {
            vscode.window.showInformationMessage('No secrets found');
            return;
        }

        // Create detail message
        const secretTypes = result.secretsFound.reduce((acc, secret) => {
            acc[secret.type] = (acc[secret.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const typeList = Object.entries(secretTypes)
            .map(([type, count]) => `• ${type}: ${count}`)
            .join('\n');

        const message = `
🛡️ **Secret Detection Details**

**File:** ${document.fileName.split('/').pop()}
**Total Secrets:** ${result.secretsFound.length}

**Secret Types:**
${typeList}

**Risk Assessment:** ${this.getRiskLevel(result.secretsFound.length)}

**Next Steps:**
• Use "Shoonya: Redact Secrets" to replace them
• Use "Shoonya: Ignore Secret" to exclude specific ones
• Check Settings to configure detection rules
        `.trim();

        vscode.window.showInformationMessage(message, 'Redact Now', 'Close')
            .then(action => {
                if (action === 'Redact Now') {
                    this.redactSecrets();
                }
            });
    }
}
