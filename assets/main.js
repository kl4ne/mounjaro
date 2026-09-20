/**
 * GLP-1 Companion v5.0.1 bootstrap.
 *
 * Production bootstrap: Firebase Modular + rebuilt PWA update manager. Runtime
 * chunks remain ordered to preserve the proven application behavior.
 */
import './firebase/platform.js';
import './firebase/ai-logic.js';
import { startPwaUpdateManager } from './pwa/update-manager.js';
export const V5_MIGRATION_PHASE = 5;
startPwaUpdateManager();
const runtimeChunks = [
    './runtime/01-core-platform.js',
    './runtime/02-state-sync-storage.js',
    './runtime/03-medication-domain.js',
    './runtime/04-navigation-dashboard.js',
    './runtime/05-nutrition-ai-ui.js',
    './runtime/06-injections-symptoms.js',
    './runtime/07-tools-reports-backups.js',
    './runtime/08-lifecycle-bootstrap.js'
];
function loadClassicScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => resolve(src);
        script.onerror = () => reject(new Error(`Failed to load runtime chunk: ${src}`));
        document.body.appendChild(script);
    });
}
async function bootstrapRuntime() {
    try {
        for (const chunk of runtimeChunks) {
            await loadClassicScript(chunk);
        }
        window.glp1V5MigrationPhase = V5_MIGRATION_PHASE;
    }
    catch (error) {
        console.error('GLP-1 Companion runtime bootstrap failed:', error);
        window.glp1BootstrapError = error instanceof Error ? error.message : String(error || 'Unknown bootstrap error');
    }
}
bootstrapRuntime();
