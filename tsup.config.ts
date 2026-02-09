import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  bundle: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  noExternal: [/.*/],
  external: [
    '@excalidraw/excalidraw',
    '@excalidraw/mermaid-to-excalidraw',
    'react', 'react-dom', 'mermaid',
  ],
  banner: { js: '#!/usr/bin/env node' },
});
