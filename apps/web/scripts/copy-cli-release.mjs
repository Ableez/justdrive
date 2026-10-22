import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../../../packages/cli/package.json'), 'utf-8'));
const built = resolve(here, '../../../packages/cli/dist/index.js');
const dest = resolve(here, '../public/r/justdrive.mjs');
const versionDest = resolve(here, '../public/r/version');

try {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(built, dest);
  await writeFile(versionDest, JSON.stringify({ version: pkg.version }) + '\n');
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error(
      'copy-cli-release: packages/cli/dist/index.js is missing. Build the CLI first: pnpm --filter justdrive build (or pnpm build at the root).',
    );
    process.exit(1);
  }
  throw error;
}
console.log(`copy-cli-release: ${dest}`);