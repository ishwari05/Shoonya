/**
 * CodeShield Diagnostics
 * Integrates with VS Code Problems panel to show detected secrets
 */

import * as vscode from 'vscode';
import { SecretDetection } from './engine-wrapper';

export class DiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codeshield');
        this.outputChannel = vscode.window.createOutputChannel('CodeShield Diagnostics');
    }

    /**
     * Update diagnostics for a document
     * @param document The document to update diagnostics for
     * @param secrets Array of detected secrets
     */
    public updateDiagnostics(document: vscode.TextDocument, secrets: SecretDetection[]): void {
        const diagnostics: vscode.Diagnostic[] = [];

        for (const secret of secrets) {
            const startPos = document.positionAt(secret.index);
            const endPos = document.positionAt(secret.index + secret.value.length);
            const range = new vscode.Range(startPos, endPos);

            const diagnostic = new vscode.Diagnostic(
                range,
                this.getDiagnosticMessage(secret),
                this.getDiagnosticSeverity(secret.type)
            );

            diagnostic.source = 'CodeShield';
            diagnostic.code = secret.type;
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];

            // Add code actions
            this.addCodeActions(diagnostic, secret);

            diagnostics.push(diagnostic);
        }

        this.diagnosticCollection.set(document.uri, diagnostics);

        // Log to output channel
        if (secrets.length > 0) {
            this.outputChannel.appendLine(`🔍 Updated diagnostics for ${document.fileName}:`);
            secrets.forEach(secret => {
                this.outputChannel.appendLine(`   - ${secret.type} at line ${document.positionAt(secret.index).line + 1}`);
            });
        }
    }

    /**
     * Clear diagnostics for a document
     * @param document The document to clear diagnostics for
     */
    public clearDiagnostics(document: vscode.TextDocument): void {
        this.diagnosticCollection.delete(document.uri);
    }

    /**
     * Clear all diagnostics
     */
    public clearAllDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Get diagnostic message for a secret
     * @param secret The secret detection
     * @returns Diagnostic message
     */
    private getDiagnosticMessage(secret: SecretDetection): string {
        const formattedType = secret.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        return `⚠️ ${formattedType} detected - This could be a sensitive credential that should not be committed`;
    }

    /**
     * Get diagnostic severity based on secret type
     * @param type The secret type
     * @returns Diagnostic severity
     */
    private getDiagnosticSeverity(type: string): vscode.DiagnosticSeverity {
        const highRiskTypes = [
            'AWS_ACCESS_KEY',
            'AWS_SECRET_KEY',
            'OPENAI_API_KEY',
            'PRIVATE_KEY',
            'GITHUB_PAT',
            'GOOGLE_API_KEY'
        ];

        if (highRiskTypes.includes(type)) {
            return vscode.DiagnosticSeverity.Error;
        }

        const mediumRiskTypes = [
            'STRIPE_LIVE_KEY',
            'STRIPE_TEST_KEY',
            'JWT_TOKEN',
            'BEARER_TOKEN',
            'SLACK_TOKEN',
            'HUGGINGFACE_TOKEN'
        ];

        if (mediumRiskTypes.includes(type)) {
            return vscode.DiagnosticSeverity.Warning;
        }

        return vscode.DiagnosticSeverity.Information;
    }

    /**
     * Add code actions to diagnostic
     * @param diagnostic The diagnostic to add actions to
     * @param secret The secret detection
     */
    private addCodeActions(diagnostic: vscode.Diagnostic, secret: SecretDetection): void {
        // Code actions will be handled by the CodeActionProvider
        // This is a placeholder for future enhancement
    }

    /**
     * Get all diagnostics for a workspace
     * @returns Array of all diagnostics
     */
    public getAllDiagnostics(): [vscode.Uri, readonly vscode.Diagnostic[]][] {
        const diagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];
        this.diagnosticCollection.forEach((uri, diagnosticArray) => {
            diagnostics.push([uri, [...diagnosticArray]]);
        });
        return diagnostics;
    }

    /**
     * Get statistics about detected secrets
     * @returns Statistics object
     */
    public getDiagnosticStats(): {
        totalSecrets: number;
        filesWithSecrets: number;
        secretsByType: Record<string, number>;
    } {
        let totalSecrets = 0;
        let filesWithSecrets = 0;
        const secretsByType: Record<string, number> = {};

        this.diagnosticCollection.forEach((uri, diagnostics) => {
            if (diagnostics.length > 0) {
                filesWithSecrets++;
                totalSecrets += diagnostics.length;

                diagnostics.forEach(diagnostic => {
                    const type = diagnostic.code as string;
                    secretsByType[type] = (secretsByType[type] || 0) + 1;
                });
            }
        });

        return { totalSecrets, filesWithSecrets, secretsByType };
    }

    /**
     * Show diagnostic statistics
     */
    public showDiagnosticStats(): void {
        const stats = this.getDiagnosticStats();
        
        if (stats.totalSecrets === 0) {
            vscode.window.showInformationMessage('✅ CodeShield: No secrets detected in workspace');
            return;
        }

        const message = `📊 CodeShield Statistics:\n` +
            `• Total secrets: ${stats.totalSecrets}\n` +
            `• Files with secrets: ${stats.filesWithSecrets}\n` +
            `• Types detected: ${Object.keys(stats.secretsByType).length}`;

        vscode.window.showInformationMessage(message, 'View Details').then(action => {
            if (action === 'View Details') {
                this.outputChannel.show();
                this.outputChannel.appendLine('\n=== CodeShield Diagnostic Statistics ===');
                this.outputChannel.appendLine(`Total secrets: ${stats.totalSecrets}`);
                this.outputChannel.appendLine(`Files with secrets: ${stats.filesWithSecrets}`);
                this.outputChannel.appendLine('\nSecrets by type:');
                
                Object.entries(stats.secretsByType).forEach(([type, count]) => {
                    this.outputChannel.appendLine(`  ${type}: ${count}`);
                });
            }
        });
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
        this.outputChannel.dispose();
    }
}
