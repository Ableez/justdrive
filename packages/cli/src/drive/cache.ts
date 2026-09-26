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
  try {
    return JSON.parse(await fs.readFile(cachePath(), 'utf-8')) as CacheData;
  } catch {
    return { paths: {} };
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
