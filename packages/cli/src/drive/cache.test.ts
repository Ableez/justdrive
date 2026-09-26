import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { clearCache, getCachedPath, invalidateCachedPath, setCachedPath } from './cache.js';

let home: string;
const cacheFile = () => path.join(home, 'paths.json');

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'justdrive-cache-'));
  process.env.JUSTDRIVE_CONFIG_DIR = home;
});

afterEach(async () => {
  delete process.env.JUSTDRIVE_CONFIG_DIR;
  await fs.rm(home, { recursive: true, force: true });
});

describe('path cache', () => {
  it('round-trips a path', async () => {
    await setCachedPath('photos', 'photos_id');
    expect(await getCachedPath('photos')).toBe('photos_id');
  });

  it('returns null for an unknown path', async () => {
    expect(await getCachedPath('nope')).toBeNull();
  });

  it('survives a corrupt cache file', async () => {
    await fs.writeFile(cacheFile(), 'not json');
    expect(await getCachedPath('photos')).toBeNull();
  });

  it('drops a removed file, its descendants and its segment keys', async () => {
    await fs.writeFile(
      cacheFile(),
      JSON.stringify({
        paths: {
          a: 'a_id',
          'a/b': 'b_id',
          'a/b/c': 'c_id',
          'a_id/b': 'b_id',
          z: 'z_id',
        },
      }),
    );

    await invalidateCachedPath('a', 'a_id');

    expect(JSON.parse(await fs.readFile(cacheFile(), 'utf-8')).paths).toEqual({ z: 'z_id' });
  });

  it('clears everything', async () => {
    await setCachedPath('a', 'a_id');
    await clearCache();
    expect(await getCachedPath('a')).toBeNull();
  });
});
