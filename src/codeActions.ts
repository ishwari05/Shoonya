/**
 * CodeShield Code Actions Provider
 * Provides quick fix actions for detected secrets
 */

import * as vscode from 'vscode';
import { SecretDetection } from './engine-wrapper';

export class CodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // Only provide actions for CodeShield diagnostics
        const codeshieldDiagnostics = context.diagnostics.filter(d => d.source === 'CodeShield');
        
        if (codeshieldDiagnostics.length === 0) {
            return actions;
        }

        // Create actions for each diagnostic
        for (const diagnostic of codeshieldDiagnostics) {
            if (diagnostic.range.contains(range)) {
                const secret = this.extractSecretFromDiagnostic(diagnostic, document);
                if (secret) {
                    actions.push(
                        this.createRedactAction(secret, document),
                        this.createIgnoreAction(secret, document),
                        this.createSafeListAction(secret, document)
                    );
                }
            }
        }

        // Add bulk actions if multiple secrets are detected
        if (codeshieldDiagnostics.length > 1) {
            actions.push(
                this.createRedactAllAction(codeshieldDiagnostics, document),
                this.createIgnoreAllAction(codeshieldDiagnostics, document)
            );
        }

        return actions;
    }

    /**
     * Extract secret information from diagnostic
     */
    private extractSecretFromDiagnostic(diagnostic: vscode.Diagnostic, document: vscode.TextDocument): SecretDetection | null {
        try {
            const text = document.getText(diagnostic.range);
            const startIndex = document.offsetAt(diagnostic.range.start);
            const type = diagnostic.code as string;

            return {
                type,
                value: text,
                index: startIndex
            };
        } catch (error) {
            console.error('Error extracting secret from diagnostic:', error);
            return null;
        }
    }

    /**
     * Create redact action for a single secret
     */
    private createRedactAction(secret: SecretDetection, document: vscode.TextDocument): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `🛡️ Redact ${this.formatSecretType(secret.type)}`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.diagnostics = [];
        action.isPreferred = true;
        
        action.command = {
            command: 'codeshield.redactSecrets',
            title: 'Redact Secret',
            arguments: [secret]
        };

        return action;
    }

    /**
     * Create ignore action for a single secret
     */
    private createIgnoreAction(secret: SecretDetection, document: vscode.TextDocument): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `👁️ Ignore ${this.formatSecretType(secret.type)}`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.diagnostics = [];
        
        action.command = {
            command: 'codeshield.ignoreSecret',
            title: 'Ignore Secret',
            arguments: [secret]
        };

        return action;
    }

    /**
     * Create safe list action for a single secret
     */
    private createSafeListAction(secret: SecretDetection, document: vscode.TextDocument): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `✅ Add ${this.formatSecretType(secret.type)} to Safe List`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.diagnostics = [];
        
        action.command = {
            command: 'codeshield.addToSafeList',
            title: 'Add to Safe List',
            arguments: [secret]
        };

        return action;
    }

    /**
     * Create redact all action
     */
    private createRedactAllAction(diagnostics: vscode.Diagnostic[], document: vscode.TextDocument): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `🛡️ Redact All ${diagnostics.length} Secrets`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.diagnostics = diagnostics;
        action.isPreferred = true;
        
        action.command = {
            command: 'codeshield.redactSecrets',
            title: 'Redact All Secrets'
        };

        return action;
    }

    /**
     * Create ignore all action
     */
    private createIgnoreAllAction(diagnostics: vscode.Diagnostic[], document: vscode.TextDocument): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `👁️ Ignore All ${diagnostics.length} Secrets`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.diagnostics = diagnostics;
        
        action.command = {
            command: 'codeshield.clearIgnored',
            title: 'Ignore All Secrets'
        };

        return action;
    }

    /**
     * Format secret type for display
     */
    private formatSecretType(type: string): string {
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
}

/**
 * Register the code action provider
 */
export function registerCodeActionProvider(): vscode.Disposable {
    return vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        new CodeActionProvider(),
        {
            providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds
        }
    );
}
