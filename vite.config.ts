import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],

  // Relative URLs keep the production build compatible with GitHub Pages
  // project sites and with the existing ./-relative PWA assets.
  base: './',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: false,
    license: { fileName: 'third-party-licenses.md' },

    // Vite 8 uses Rolldown. Keep the two entry assets deterministic so the
    // service worker can pre-cache them without a generated manifest lookup.
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/main.js',
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames(assetInfo: { names?: readonly string[]; name?: string }) {
          const names = Array.isArray(assetInfo.names) ? assetInfo.names : [];
          const candidate = String(names[0] || assetInfo.name || 'asset');
          if (candidate.endsWith('.css')) return 'assets/app.css';
          return 'assets/[name]-[hash].[ext]';
        }
      }
    }
  }
});
