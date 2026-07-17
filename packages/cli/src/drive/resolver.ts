import { drive_v3 } from 'googleapis';
import { JUSTSTORE_ROOT_FOLDER, PathNotFoundError, normalizePath } from '@juststore/shared';
import { getDriveClient } from './client.js';
import { getCachedPath, setCachedPath } from './cache.js';

export async function resolvePath(path: string): Promise<string> {
  const normalized = normalizePath(path);
  if (!normalized) {
    const rootId = await getRootFolderId();
    return rootId;
  }

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
  if (!files || files.length === 0) {
    throw new PathNotFoundError(name);
  }

  const fileId = files[0].id!;
  await setCachedPath(`${parentId}/${name}`, fileId);
  return fileId;
}

export async function getRootFolderId(): Promise<string> {
  const cached = await getCachedPath('__root__');
  if (cached) return cached;

  const drive = await getDriveClient();
  const response = await drive.files.list({
    q: `name='${JUSTSTORE_ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  const files = response.data.files;
  if (files && files.length > 0) {
    const rootId = files[0].id!;
    await setCachedPath('__root__', rootId);
    return rootId;
  }

  const createResponse = await drive.files.create({
    requestBody: {
      name: JUSTSTORE_ROOT_FOLDER,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  const rootId = createResponse.data.id!;
  await setCachedPath('__root__', rootId);
  return rootId;
}

function escapeQuery(value: string): string {
  return value.replace(/'/g, "\\'");
}
