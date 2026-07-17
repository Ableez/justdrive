import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  noExternal: ['@juststore/shared'],
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __CLIENT_ID__: JSON.stringify(process.env.CLI_BUILD_CLIENT_ID || ''),
    __CLIENT_SECRET__: JSON.stringify(process.env.CLI_BUILD_CLIENT_SECRET || ''),
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
});
