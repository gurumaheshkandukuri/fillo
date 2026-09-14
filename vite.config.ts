import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/content.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'popup/popup.js';
          }
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'popup/popup.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  plugins: [
    {
      name: 'fillo-extension-organizer',
      generateBundle() {
        // Emit manifest.json into dist/manifest.json
        const manifestSource = fs.readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8');
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: manifestSource,
        });
      },
      closeBundle() {
        const srcPopupFile = resolve(__dirname, 'dist/src/popup/popup.html');
        const targetPopupDir = resolve(__dirname, 'dist/popup');
        const targetPopupFile = resolve(targetPopupDir, 'popup.html');

        if (fs.existsSync(srcPopupFile)) {
          if (!fs.existsSync(targetPopupDir)) {
            fs.mkdirSync(targetPopupDir, { recursive: true });
          }
          let html = fs.readFileSync(srcPopupFile, 'utf-8');
          // Update relative references from ../../popup/... or similar to ./...
          html = html
            .replace(/(\.\.\/)+popup\//g, './')
            .replace(/\/popup\//g, './');
          fs.writeFileSync(targetPopupFile, html);
        }

        // Clean up dist/src
        const distSrc = resolve(__dirname, 'dist/src');
        if (fs.existsSync(distSrc)) {
          fs.rmSync(distSrc, { recursive: true, force: true });
        }
      },
    },
  ],
});
