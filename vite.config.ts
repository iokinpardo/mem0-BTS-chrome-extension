import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/popup.html'),
        dashboard: resolve(root, 'src/dashboard.html'),
      },
    },
  },
});
