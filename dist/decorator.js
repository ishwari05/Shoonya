"use strict";
/**
 * CodeShield Decorator
 * Handles highlighting secrets in the VS Code editor
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
exports.SecretDecorator = void 0;
const vscode = __importStar(require("vscode"));
class SecretDecorator {
    constructor() {
        // Create decoration type for red underline highlighting
        this.decorationType = vscode.window.createTextEditorDecorationType({
            textDecoration: 'underline wavy rgba(255, 0, 0, 0.8)',
            color: 'rgba(255, 0, 0, 0.8)',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '2px',
            overviewRulerColor: 'red',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            light: {
                textDecoration: 'underline wavy rgba(255, 0, 0, 0.8)',
                color: 'rgba(200, 0, 0, 0.8)',
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                border: '1px solid rgba(255, 0, 0, 0.3)'
            },
            dark: {
                textDecoration: 'underline wavy rgba(255, 100, 100, 0.8)',
                color: 'rgba(255, 100, 100, 0.8)',
                backgroundColor: 'rgba(255, 0, 0, 0.2)',
                border: '1px solid rgba(255, 100, 100, 0.3)'
            }
        });
        // Create status bar item
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = 'codeshield.scanDocument';
        // Create output channel for logging
        this.outputChannel = vscode.window.createOutputChannel('CodeShield');
    }
    /**
     * Update decorations in the active editor
     * @param secrets Array of detected secrets
     */
    updateDecorations(secrets) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor)
            return;
        const decorations = [];
        const document = activeEditor.document;
        for (const secret of secrets) {
            const startPos = document.positionAt(secret.index);
            const endPos = document.positionAt(secret.index + secret.value.length);
            const range = new vscode.Range(startPos, endPos);
            decorations.push({
                range,
                hoverMessage: new vscode.MarkdownString(`⚠️ **${this.formatSecretType(secret.type)}** detected\n\n` +
                    `Type: \`${secret.type}\`\n` +
                    `Length: ${secret.value.length} characters\n\n` +
                    `[Redact Secret](command:codeshield.redactSecrets?${encodeURIComponent(JSON.stringify(secret))}) | ` +
                    `[Ignore](command:codeshield.ignoreSecret?${encodeURIComponent(JSON.stringify(secret))})`)
            });
        }
        // Apply decorations
        activeEditor.setDecorations(this.decorationType, decorations);
        // Update status bar
        this.updateStatusBar(secrets.length);
        // Log to output channel
        if (secrets.length > 0) {
            this.outputChannel.appendLine(`🔍 Found ${secrets.length} secret(s) in ${document.fileName}`);
            secrets.forEach(secret => {
                this.outputChannel.appendLine(`   - ${secret.type} at position ${secret.index}`);
            });
        }
    }
    /**
     * Clear all decorations
     */
    clearDecorations() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.decorationType, []);
        }
        this.statusBar.hide();
    }
    /**
     * Update status bar with secret count
     * @param count Number of secrets detected
     */
    updateStatusBar(count) {
        if (count === 0) {
            this.statusBar.hide();
            return;
        }
        this.statusBar.text = `$(shield) ${count} secret${count > 1 ? 's' : ''}`;
        this.statusBar.tooltip = `CodeShield detected ${count} secret${count > 1 ? 's' : ''}. Click to scan document.`;
        this.statusBar.backgroundColor = count > 3 ?
            new vscode.ThemeColor('statusBarItem.errorBackground') :
            new vscode.ThemeColor('statusBarItem.warningBackground');
        this.statusBar.show();
    }
    /**
     * Format secret type for display
     * @param type The secret type
     * @returns Formatted display string
     */
    formatSecretType(type) {
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    /**
     * Show notification for detected secrets
     * @param secrets Array of detected secrets
     * @param document The document where secrets were found
     */
    showSecretNotification(secrets, document) {
        if (secrets.length === 0)
            return;
        const config = vscode.workspace.getConfiguration('codeshield');
        if (!config.get('showNotifications'))
            return;
        const riskLevel = this.getRiskLevel(secrets);
        const message = `⚠ CodeShield detected ${secrets.length} possible secret${secrets.length > 1 ? 's' : ''} in ${document.fileName.split('/').pop()}`;
        const actions = [
            'Redact All',
            'View Details',
            'Ignore'
        ];
        vscode.window.showWarningMessage(message, ...actions).then(action => {
            if (action === 'Redact All') {
                vscode.commands.executeCommand('codeshield.redactSecrets');
            }
            else if (action === 'View Details') {
                this.outputChannel.show();
            }
            else if (action === 'Ignore') {
                this.clearDecorations();
            }
        });
    }
    /**
     * Get risk level from secrets
     * @param secrets Array of detected secrets
     * @returns Risk level string
     */
    getRiskLevel(secrets) {
        const highRiskTypes = [
            'AWS_ACCESS_KEY',
            'AWS_SECRET_KEY',
            'OPENAI_API_KEY',
            'PRIVATE_KEY',
            'GITHUB_PAT',
            'GOOGLE_API_KEY'
        ];
        const hasHighRisk = secrets.some(secret => highRiskTypes.includes(secret.type));
        if (hasHighRisk)
            return 'high';
        if (secrets.length > 3)
            return 'medium';
        return 'low';
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.decorationType.dispose();
        this.statusBar.dispose();
        this.outputChannel.dispose();
    }
}
exports.SecretDecorator = SecretDecorator;
//# sourceMappingURL=decorator.js.map