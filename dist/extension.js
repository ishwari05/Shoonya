"use strict";
/**
 * CodeShield VS Code Extension
 * Main extension entry point
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const decorator_1 = require("./decorator");
const diagnostics_1 = require("./diagnostics");
const commands_1 = require("./commands");
const engine_wrapper_1 = require("./engine-wrapper");
const codeActions_1 = require("./codeActions");
// Global instances
let decorator;
let diagnosticProvider;
let commandHandler;
let disposables = [];
/**
 * Extension activation
 */
async function activate(context) {
    console.log('🔥 CodeShield extension is now active!');
    // Initialize components
    decorator = new decorator_1.SecretDecorator();
    diagnosticProvider = new diagnostics_1.DiagnosticProvider();
    commandHandler = new commands_1.CommandHandler(decorator, diagnosticProvider);
    // Register commands
    const commands = commandHandler.registerCommands();
    disposables.push(...commands);
    // Register code action provider
    const codeActionProvider = (0, codeActions_1.registerCodeActionProvider)();
    disposables.push(codeActionProvider);
    // Register event listeners
    registerEventListeners();
    // Scan currently open documents
    await scanOpenDocuments();
    // Show welcome message
    const config = vscode.workspace.getConfiguration('codeshield');
    if (config.get('enabled')) {
        vscode.window.showInformationMessage('🛡️ CodeShield is active - protecting your secrets', 'Learn More').then(action => {
            if (action === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/codeshield-security/codeshield-vscode'));
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
function deactivate() {
    console.log('🔥 CodeShield extension deactivated');
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
function registerEventListeners() {
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
        }
        else {
            if (decorator) {
                decorator.clearDecorations();
            }
        }
    });
    disposables.push(editorChangeDisposable);
    // Before save (optional auto-redaction)
    const saveDisposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
        console.log('🔧 Document saving, checking for secrets...');
        const config = vscode.workspace.getConfiguration('codeshield');
        if (config.get('autoRedact')) {
            await handleAutoRedaction(event.document);
        }
    });
    disposables.push(saveDisposable);
    // Clipboard protection
    const clipboardDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const config = vscode.workspace.getConfiguration('codeshield');
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
    let timeout;
    return (document) => {
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
async function scanOpenDocuments() {
    for (const document of vscode.workspace.textDocuments) {
        if (commandHandler) {
            await commandHandler.scanDocument(document);
        }
    }
}
/**
 * Handle automatic redaction before save
 */
async function handleAutoRedaction(document) {
    try {
        const result = engine_wrapper_1.CodeShieldEngine.processText(document.getText());
        if (result.secretsFound.length > 0) {
            const confirmMessage = `Auto-redacting ${result.secretsFound.length} secret${result.secretsFound.length > 1 ? 's' : ''} before save. This action cannot be undone.`;
            const action = await vscode.window.showWarningMessage(confirmMessage, 'Redact', 'Cancel');
            if (action === 'Redact') {
                if (commandHandler) {
                    await commandHandler.redactSecrets();
                }
            }
            else if (action === 'Cancel') {
                // Cancel the save operation
                throw new Error('Save cancelled by user');
            }
        }
    }
    catch (error) {
        console.error('❌ Auto-redaction error:', error);
        vscode.window.showErrorMessage(`Auto-redaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Handle clipboard protection
 */
async function handleClipboardProtection(event) {
    // Check if this was a paste operation
    const isPaste = event.contentChanges.some(change => change.text.length > 50 && // Large text insertion likely from clipboard
        !change.range.isEmpty // Replacing existing text
    );
    if (isPaste) {
        const text = event.document.getText();
        const result = engine_wrapper_1.CodeShieldEngine.processText(text);
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
async function handleGitProtection() {
    const config = vscode.workspace.getConfiguration('codeshield');
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
                const secrets = engine_wrapper_1.CodeShieldEngine.quickScan(document.getText());
                secretsFound += secrets.length;
            }
        }
        catch (error) {
            // Git not initialized or other error
            return;
        }
    }
    if (secretsFound > 0) {
        const action = await vscode.window.showWarningMessage(`🚨 CodeShield detected ${secretsFound} secret${secretsFound > 1 ? 's' : ''} in files that would be committed. Commit blocked.`, 'View Details', 'Force Commit', 'Cancel');
        if (action === 'View Details') {
            vscode.commands.executeCommand('codeshield.showStats');
        }
        else if (action === 'Cancel') {
            throw new Error('Commit blocked by CodeShield');
        }
    }
}
/**
 * Handle configuration changes
 */
async function handleConfigurationChange() {
    const config = vscode.workspace.getConfiguration('codeshield');
    if (!config.get('enabled')) {
        // Clear all decorations and diagnostics when disabled
        decorator.clearDecorations();
        diagnosticProvider.clearAllDiagnostics();
        vscode.window.showInformationMessage('CodeShield disabled');
    }
    else {
        // Re-scan all documents when enabled
        await scanOpenDocuments();
        vscode.window.showInformationMessage('CodeShield enabled');
    }
}
//# sourceMappingURL=extension.js.map