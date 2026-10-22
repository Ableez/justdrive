import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { getApiUrl } from '../api/client.js';
import { getConfigDir } from '../config/paths.js';
import { playLogoAnimation } from '../output/ascii-logo.js';
import { title, note, line } from '../output/ui.js';

declare const __VERSION__: string;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface UpdateState {
  lastCheck: number;
  latestVersion: string | null;
}

function statePath(): string {
  return path.join(getConfigDir(), 'update.json');
}

async function readState(): Promise<UpdateState> {
  try {
    const raw = await fs.readFile(statePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<UpdateState>;
    return {
      lastCheck: typeof parsed.lastCheck === 'number' ? parsed.lastCheck : 0,
      latestVersion: typeof parsed.latestVersion === 'string' ? parsed.latestVersion : null,
    };
  } catch {
    return { lastCheck: 0, latestVersion: null };
  }
}

async function writeState(state: UpdateState): Promise<void> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(statePath(), JSON.stringify(state), { mode: 0o600 });
}

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${getApiUrl()}/r/version`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: string };
    return typeof body.version === 'string' ? body.version : null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(notify = true): Promise<string | null> {
  const state = await readState();
  if (Date.now() - state.lastCheck < CHECK_INTERVAL_MS && state.latestVersion) {
    if (notify && state.latestVersion !== __VERSION__) {
      console.error(chalk.yellow(`Update available: ${state.latestVersion} (current ${__VERSION__}). Run: jd update`));
    }
    return state.latestVersion;
  }

  const latest = await fetchLatestVersion();
  await writeState({ lastCheck: Date.now(), latestVersion: latest });
  if (notify && latest && latest !== __VERSION__) {
    console.error(chalk.yellow(`Update available: ${latest} (current ${__VERSION__}). Run: jd update`));
  }
  return latest;
}

export const updateCommand = new Command('update')
  .description('Update justdrive to the latest release')
  .action(async () => {
    await playLogoAnimation();
    title('Update');
    console.log('Checking for updates...');
    const latest = await fetchLatestVersion();
    if (!latest) {
      console.error('Could not reach the update server.');
      process.exitCode = 1;
      return;
    }
    if (latest === __VERSION__) {
      console.log(chalk.green(`Already up to date (${__VERSION__}).`));
      await writeState({ lastCheck: Date.now(), latestVersion: latest });
      return;
    }

    const currentPath = path.resolve(process.argv[1] || '');
    if (!currentPath) {
      console.error('Cannot determine the current binary path.');
      process.exitCode = 1;
      return;
    }

    console.log(`Updating to ${latest}...`);
    const response = await fetch(`${getApiUrl()}/r/justdrive.mjs`);
    if (!response.ok) {
      console.error('Download failed.');
      process.exitCode = 1;
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const temp = `${currentPath}.tmp.${process.pid}`;
    await fs.writeFile(temp, buffer, { mode: 0o755 });
    await fs.rename(temp, currentPath);
    await writeState({ lastCheck: Date.now(), latestVersion: latest });
    console.log(chalk.green(`Updated to ${latest}.`));
  });