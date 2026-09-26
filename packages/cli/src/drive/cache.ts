import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CONFIG_DIR, CACHE_FILE } from '@juststore/shared';

interface CacheData {
  paths: Record<string, string>;
}

function getCachePath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CACHE_FILE);
}

export async function getCachedPath(drivePath: string): Promise<string | null> {
  try {
    const data = await readCache();
    return data.paths[drivePath] || null;
  } catch {
    return null;
  }
}

export async function setCachedPath(drivePath: string, fileId: string): Promise<void> {
  const data = await readCache();
  data.paths[drivePath] = fileId;
  await writeCache(data);
}

export async function removeCachedPath(drivePath: string): Promise<void> {
  const data = await readCache();
  delete data.paths[drivePath];
  await writeCache(data);
}

/**
 * Drop every cache entry that points at or below a file that was removed or
 * moved: its path, its descendants' paths, and segment keys under its ID.
 */
export async function invalidateCachedPath(drivePath: string, fileId: string): Promise<void> {
  const data = await readCache();
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
  await writeCache(data);
}

export async function clearCache(): Promise<void> {
  await writeCache({ paths: {} });
}

export async function loadConfig(): Promise<{
  rootFolderId?: string;
  userEmail?: string;
}> {
  try {
    const data = await readCache();
    return {
      rootFolderId: data.paths['__root__'],
      userEmail: data.paths['__user_email__'],
    };
  } catch {
    return {};
  }
}

async function readCache(): Promise<CacheData> {
  try {
    const raw = await fs.readFile(getCachePath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { paths: {} };
  }
}

async function writeCache(data: CacheData): Promise<void> {
  const cachePath = getCachePath();
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
}
