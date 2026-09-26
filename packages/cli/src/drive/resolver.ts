import { drive_v3 } from 'googleapis';
import { PathNotFoundError, normalizePath } from '@juststore/shared';
import { getDriveClient } from './client.js';
import { getCachedPath, setCachedPath } from './cache.js';
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

export async function getFileById(fileId: string): Promise<drive_v3.Schema$File> {
  const drive = await getDriveClient();
  const response = await drive.files.get({ fileId, fields: 'id, name, size, mimeType' });
  return response.data;
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
