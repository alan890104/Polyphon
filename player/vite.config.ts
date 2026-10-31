// Vite config for the player. The library resolves to its TypeScript source (the "polyphon-source" export condition),
// and the dev server may read outside player/, where src/ and examples/ live.

import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: { conditions: ['polyphon-source', ...defaultClientConditions] },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  // The music box's chunk carries three.js (about 580 kB, fetched only when the music box is shown)
  build: { chunkSizeWarningLimit: 640 },
});
