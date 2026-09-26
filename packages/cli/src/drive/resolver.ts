import { drive_v3 } from 'googleapis';
import { PathNotFoundError, normalizePath } from '@juststore/shared';
import { getDriveClient } from './client.js';
import { getCachedPath, removeCachedPath, setCachedPath } from './cache.js';
import { requireSession } from '../api/client.js';

export async function getRootFolderId(): Promise<string> {
  const session = await requireSession();
  if (!session.rootFolderId) {
    throw new Error('Root folder unknown yet. The first Drive command sets it. Try again.');
  }
  return session.rootFolderId;
}

export async function resolvePath(path: string): Promise<string> {
  const normalized = normalizePath(path);
  if (!normalized) return getRootFolderId();

  const cached = await getCachedPath(normalized);
  if (cached) return cached;

  const segments = normalized.split('/');
  let parentId = await getRootFolderId();
  for (const segment of segments) {
    parentId = await resolveSegment(segment, parentId);
  }

  await setCachedPath(normalized, parentId);
  return parentId;
}

async function resolveSegment(name: string, parentId: string): Promise<string> {
  const cached = await getCachedPath(`${parentId}/${name}`);
  if (cached) return cached;

  const drive = await getDriveClient();
  const response = await drive.files.list({
    q: `name='${escapeQuery(name)}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const files = response.data.files;
  if (!files || files.length === 0) throw new PathNotFoundError(name);

  const fileId = files[0].id!;
  await setCachedPath(`${parentId}/${name}`, fileId);
  return fileId;
}

/**
 * The path cache has no way to notice that another machine moved or removed the
 * file, so anything destructive confirms the id with Drive before acting. A
 * mismatch drops the entry and resolves again.
 */
export async function resolvePathForWrite(drivePath: string): Promise<string> {
  const normalized = normalizePath(drivePath);
  const cached = await getCachedPath(normalized);
  if (!cached) return resolvePath(normalized);

  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId: cached,
    fields: 'id, name, trashed, parents',
  });

  const file = response.data;
  const parentId = await resolvePath(normalized.split('/').slice(0, -1).join('/'));
  const stillThere =
    !file.trashed &&
    file.name === normalized.split('/').pop() &&
    (file.parents ?? []).includes(parentId);

  if (stillThere) return cached;

  await removeCachedPath(normalized);
  return resolvePath(normalized);
}

export async function getFileById(fileId: string): Promise<drive_v3.Schema$File> {
  const drive = await getDriveClient();
  const response = await drive.files.get({ fileId, fields: 'id, name, size, mimeType' });
  return response.data;
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
