"use strict";
/**
 * CodeShield Code Actions Provider
 * Provides quick fix actions for detected secrets
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
exports.CodeActionProvider = void 0;
exports.registerCodeActionProvider = registerCodeActionProvider;
const vscode = __importStar(require("vscode"));
class CodeActionProvider {
    provideCodeActions(document, range, context, token) {
        const actions = [];
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
                    actions.push(this.createRedactAction(secret, document), this.createIgnoreAction(secret, document), this.createSafeListAction(secret, document));
                }
            }
        }
        // Add bulk actions if multiple secrets are detected
        if (codeshieldDiagnostics.length > 1) {
            actions.push(this.createRedactAllAction(codeshieldDiagnostics, document), this.createIgnoreAllAction(codeshieldDiagnostics, document));
        }
        return actions;
    }
    /**
     * Extract secret information from diagnostic
     */
    extractSecretFromDiagnostic(diagnostic, document) {
        try {
            const text = document.getText(diagnostic.range);
            const startIndex = document.offsetAt(diagnostic.range.start);
            const type = diagnostic.code;
            return {
                type,
                value: text,
                index: startIndex
            };
        }
        catch (error) {
            console.error('Error extracting secret from diagnostic:', error);
            return null;
        }
    }
    /**
     * Create redact action for a single secret
     */
    createRedactAction(secret, document) {
        const action = new vscode.CodeAction(`🛡️ Redact ${this.formatSecretType(secret.type)}`, vscode.CodeActionKind.QuickFix);
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
    createIgnoreAction(secret, document) {
        const action = new vscode.CodeAction(`👁️ Ignore ${this.formatSecretType(secret.type)}`, vscode.CodeActionKind.QuickFix);
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
    createSafeListAction(secret, document) {
        const action = new vscode.CodeAction(`✅ Add ${this.formatSecretType(secret.type)} to Safe List`, vscode.CodeActionKind.QuickFix);
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
    createRedactAllAction(diagnostics, document) {
        const action = new vscode.CodeAction(`🛡️ Redact All ${diagnostics.length} Secrets`, vscode.CodeActionKind.QuickFix);
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
    createIgnoreAllAction(diagnostics, document) {
        const action = new vscode.CodeAction(`👁️ Ignore All ${diagnostics.length} Secrets`, vscode.CodeActionKind.QuickFix);
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
    formatSecretType(type) {
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
}
exports.CodeActionProvider = CodeActionProvider;
CodeActionProvider.providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
];
/**
 * Register the code action provider
 */
function registerCodeActionProvider() {
    return vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, new CodeActionProvider(), {
        providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds
    });
}
//# sourceMappingURL=codeActions.js.map