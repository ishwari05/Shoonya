/**
 * CodeShield Code Actions Provider
 * Provides quick fix actions for detected secrets
 */
import * as vscode from 'vscode';
export declare class CodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds: vscode.CodeActionKind[];
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[];
    /**
     * Extract secret information from diagnostic
     */
    private extractSecretFromDiagnostic;
    /**
     * Create redact action for a single secret
     */
    private createRedactAction;
    /**
     * Create ignore action for a single secret
     */
    private createIgnoreAction;
    /**
     * Create safe list action for a single secret
     */
    private createSafeListAction;
    /**
     * Create redact all action
     */
    private createRedactAllAction;
    /**
     * Create ignore all action
     */
    private createIgnoreAllAction;
    /**
     * Format secret type for display
     */
    private formatSecretType;
}
/**
 * Register the code action provider
 */
export declare function registerCodeActionProvider(): vscode.Disposable;
//# sourceMappingURL=codeActions.d.ts.map