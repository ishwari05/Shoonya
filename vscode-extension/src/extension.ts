/**
 * Shoonya VS Code Extension
 * Main extension entry point
 */

import * as vscode from 'vscode';
import { SecretDecorator } from './decorator';
import { DiagnosticProvider } from './diagnostics';
import { CommandHandler } from './commands';
import { ShoonyaEngine } from './engine-wrapper';
import { registerCodeActionProvider } from './codeActions';

// Global instances
let decorator: SecretDecorator;
let diagnosticProvider: DiagnosticProvider;
let commandHandler: CommandHandler;
let disposables: vscode.Disposable[] = [];

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('🔥 Shoonya extension is now active!');

    // Initialize components
    decorator = new SecretDecorator();
    diagnosticProvider = new DiagnosticProvider();
    commandHandler = new CommandHandler(decorator, diagnosticProvider);

    // Register commands
    const commands = commandHandler.registerCommands();
    disposables.push(...commands);

    // Register code action provider
    const codeActionProvider = registerCodeActionProvider();
    disposables.push(codeActionProvider);

    // Register event listeners
    registerEventListeners();

    // Scan currently open documents
    await scanOpenDocuments();

    // Show welcome message
    const config = vscode.workspace.getConfiguration('shoonya');
    if (config.get('enabled') as boolean) {
        vscode.window.showInformationMessage(
            '🛡️ Shoonya is active - protecting your secrets',
            'Learn More'
        ).then(action => {
            if (action === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/shoonya-security/shoonya-vscode'));
            }
        });
    }

    // Add all disposables to context
    context.subscriptions.push(...disposables);
    context.subscriptions.push(decorator);
    context.subscriptions.push(diagnosticProvider);
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    console.log('🔥 Shoonya extension deactivated');
    
    // Clear decorations and diagnostics
    if (decorator) {
        decorator.clearDecorations();
    }
    if (diagnosticProvider) {
        diagnosticProvider.clearAllDiagnostics();
    }
    
    // Dispose of all disposables
    disposables.forEach(d => d.dispose());
    disposables = [];
}

/**
 * Register event listeners for real-time detection
 */
function registerEventListeners(): void {
    console.log('🔧 Registering event listeners...');
    
    // Document changes
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
            console.log('🔧 Document changed, scanning...');
            await debounceScan(event.document);
        }
    });
    disposables.push(changeDisposable);

    // Document open
    const openDisposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
        console.log('🔧 Document opened, scanning...');
        if (commandHandler) {
            await commandHandler.scanDocument(document);
        }
    });
    disposables.push(openDisposable);

    // Active editor change
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        console.log('🔧 Active editor changed, scanning...');
        if (editor && commandHandler) {
            await commandHandler.scanDocument(editor.document);
        } else {
            if (decorator) {
                decorator.clearDecorations();
            }
        }
    });
    disposables.push(editorChangeDisposable);

    // Before save (optional auto-redaction)
    const saveDisposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
        console.log('🔧 Document saving, checking for secrets...');
        const config = vscode.workspace.getConfiguration('shoonya');
        if (config.get('autoRedact')) {
            await handleAutoRedaction(event.document);
        }
    });
    disposables.push(saveDisposable);

    // Clipboard protection
    const clipboardDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const config = vscode.workspace.getConfiguration('shoonya');
        if (config.get('clipboardProtection')) {
            await handleClipboardProtection(event);
        }
    });
    disposables.push(clipboardDisposable);

    console.log('🔧 Event listeners registered successfully');
}

/**
 * Debounced scan function
 */
const debounceScan = (() => {
    let timeout: NodeJS.Timeout | undefined;
    return (document: vscode.TextDocument) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            if (commandHandler) {
                commandHandler.scanDocument(document);
            }
        }, 500); // 500ms debounce
    };
})();

/**
 * Scan all currently open documents
 */
async function scanOpenDocuments(): Promise<void> {
    for (const document of vscode.workspace.textDocuments) {
        if (commandHandler) {
            await commandHandler.scanDocument(document);
        }
    }
}

/**
 * Handle automatic redaction before save
 */
async function handleAutoRedaction(document: vscode.TextDocument): Promise<void> {
    try {
        const result = ShoonyaEngine.processText(document.getText());
        
        if (result.secretsFound.length > 0) {
            const confirmMessage = `Auto-redacting ${result.secretsFound.length} secret${result.secretsFound.length > 1 ? 's' : ''} before save. This action cannot be undone.`;
            const action = await vscode.window.showWarningMessage(confirmMessage, 'Redact', 'Cancel');
            
            if (action === 'Redact') {
                if (commandHandler) {
                    await commandHandler.redactSecrets();
                }
            } else if (action === 'Cancel') {
                // Cancel the save operation
                throw new Error('Save cancelled by user');
            }
        }
    } catch (error) {
        console.error('❌ Auto-redaction error:', error);
        vscode.window.showErrorMessage(`Auto-redaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Handle clipboard protection
 */
async function handleClipboardProtection(event: vscode.TextDocumentChangeEvent): Promise<void> {
    // Check if this was a paste operation
    const isPaste = event.contentChanges.some(change => 
        change.text.length > 50 && // Large text insertion likely from clipboard
        !change.range.isEmpty   // Replacing existing text
    );
    
    if (isPaste) {
        const text = event.document.getText();
        const result = ShoonyaEngine.processText(text);
        
        if (result.secretsFound.length > 0) {
            const confirmMessage = `You pasted text containing ${result.secretsFound.length} secret${result.secretsFound.length > 1 ? 's' : ''}. This could expose sensitive information.`;
            const action = await vscode.window.showWarningMessage(confirmMessage, 'Review', 'Continue');
            
            if (action === 'Review') {
                // Show the secrets in the problems panel
                if (diagnosticProvider) {
                    diagnosticProvider.updateDiagnostics(event.document, result.secretsFound);
                }
            }
        }
    }
}

/**
 * Handle Git commit protection
 */
async function handleGitProtection(): Promise<void> {
    const config = vscode.workspace.getConfiguration('shoonya');
    if (!config.get('gitProtection')) {
        return;
    }

    // This is a simplified implementation
    // In a real implementation, you'd integrate with Git extension APIs
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    // Check for staged files with secrets
    let secretsFound = 0;
    for (const folder of workspaceFolders) {
        const gitPath = `${folder.uri.fsPath}/.git`;
        try {
            // This would require implementing Git integration
            // For now, just scan all files in workspace
            const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const secrets = ShoonyaEngine.quickScan(document.getText());
                secretsFound += secrets.length;
            }
        } catch (error) {
            // Git not initialized or other error
            return;
        }
    }

    if (secretsFound > 0) {
        const action = await vscode.window.showWarningMessage(
            `🚨 Shoonya detected ${secretsFound} secret${secretsFound > 1 ? 's' : ''} in files that would be committed. Commit blocked.`,
            'View Details',
            'Force Commit',
            'Cancel'
        );

        if (action === 'View Details') {
            vscode.commands.executeCommand('shoonya.showStats');
        } else if (action === 'Cancel') {
            throw new Error('Commit blocked by Shoonya');
        }
    }
}

/**
 * Handle configuration changes
 */
async function handleConfigurationChange(): Promise<void> {
    const config = vscode.workspace.getConfiguration('shoonya');
    
    if (!config.get('enabled')) {
        // Clear all decorations and diagnostics when disabled
        decorator.clearDecorations();
        diagnosticProvider.clearAllDiagnostics();
        vscode.window.showInformationMessage('Shoonya disabled');
    } else {
        // Re-scan all documents when enabled
        await scanOpenDocuments();
        vscode.window.showInformationMessage('Shoonya enabled');
    }
}
