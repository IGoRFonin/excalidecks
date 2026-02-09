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
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire } from 'module';",
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
  external: [
    // Frontend-only deps (not needed at runtime)
    '@excalidraw/excalidraw',
    '@excalidraw/mermaid-to-excalidraw',
    'react', 'react-dom', 'mermaid',
  ],
});
