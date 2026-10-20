import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const built = resolve(here, '../../../packages/cli/dist/index.js');
const dest = resolve(here, '../public/r/justdrive.mjs');

try {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(built, dest);
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
