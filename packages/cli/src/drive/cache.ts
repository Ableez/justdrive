import fs from 'fs/promises';
import path from 'path';
import { getConfigDir } from '../config/paths.js';

const CACHE_FILE = 'paths.json';

interface CacheData {
  paths: Record<string, string>;
}

function cachePath(): string {
  return path.join(getConfigDir(), CACHE_FILE);
}

async function read(): Promise<CacheData> {
  const target = cachePath();

  let raw: string;
  try {
    raw = await fs.readFile(target, 'utf-8');
  } catch (error) {
    // A missing cache is normal. Anything else has to be said out loud, or a
    // permission problem looks like an empty cache for the rest of the session.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Could not read ${target}: ${(error as Error).message}`);
    }
    return { paths: {} };
  }

  const parsed = parseCache(raw);
  if (!parsed) {
    console.error(`The path cache at ${target} is corrupt and was ignored.`);
    return { paths: {} };
  }
  return parsed;
}

function parseCache(raw: string): CacheData | null {
  try {
    const parsed = JSON.parse(raw) as CacheData;
    if (!parsed.paths || typeof parsed.paths !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function write(data: CacheData): Promise<void> {
  const target = cachePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2));
}

export async function getCachedPath(drivePath: string): Promise<string | null> {
  return (await read()).paths[drivePath] ?? null;
}

export async function setCachedPath(drivePath: string, fileId: string): Promise<void> {
  const data = await read();
  data.paths[drivePath] = fileId;
  await write(data);
}

export async function removeCachedPath(drivePath: string): Promise<void> {
  const data = await read();
  delete data.paths[drivePath];
  await write(data);
}

/**
 * Drops every entry pointing at or below a removed or moved file: its path, its
 * descendants' paths, and segment keys under its id.
 */
export async function invalidateCachedPath(drivePath: string, fileId: string): Promise<void> {
  const data = await read();
  for (const [key, value] of Object.entries(data.paths)) {
    if (
      value === fileId ||
      key === drivePath ||
      key.startsWith(`${drivePath}/`) ||
      key.startsWith(`${fileId}/`)
    ) {
      delete data.paths[key];
    }
  }
  await write(data);
}

export async function clearCache(): Promise<void> {
  await write({ paths: {} });
}
