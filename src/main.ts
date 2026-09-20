/**
 * GLP-1 Companion v5.5.0 bootstrap.
 *
 * Production bootstrap: Firebase Modular + rebuilt PWA update manager. Runtime
 * chunks remain ordered to preserve the proven application behavior.
 */
import './styles.css';
import Chart from 'chart.js/auto';
import { createIcons, icons } from 'lucide';
import './firebase/platform';
import './firebase/ai-logic';
import { startPwaUpdateManager } from './pwa/update-manager';

// v5.5.0: generated runtime chunks are emitted from TypeScript during every build.
// The classic runtime chunks use the same global names as the proven v5.0.1 runtime.
window.Chart = Chart;
window.lucide = {
  createIcons: () => createIcons({ icons })
};

export const V5_MIGRATION_PHASE = 6;

startPwaUpdateManager();

const runtimeChunks = [
  './runtime/01-core-platform.js',
  './runtime/02-state-sync-storage.js',
  './runtime/03-medication-domain.js',
  './runtime/04-navigation-dashboard.js',
  './runtime/05-nutrition-ai-ui.js',
  './runtime/06-injections-symptoms.js',
  './runtime/07-tools-reports-backups.js',
  './runtime/08-lifecycle-bootstrap.js',
  './runtime/09-ai-intelligence.js',
  './runtime/10-ai-phase2.js'
] as const;

function loadClassicScript(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve(src);
    script.onerror = () => reject(new Error(`Failed to load runtime chunk: ${src}`));
    document.body.appendChild(script);
  });
}

async function bootstrapRuntime(): Promise<void> {
  try {
    for (const chunk of runtimeChunks) {
      await loadClassicScript(chunk);
    }
    window.glp1V5MigrationPhase = V5_MIGRATION_PHASE;
  } catch (error: unknown) {
    console.error('GLP-1 Companion runtime bootstrap failed:', error);
    window.glp1BootstrapError = error instanceof Error ? error.message : String(error || 'Unknown bootstrap error');
  }
}

bootstrapRuntime();
