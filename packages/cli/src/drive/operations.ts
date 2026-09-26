import { drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import {
  DriveFile,
  DRIVE_FIELDS,
  JustStoreError,
  PathNotFoundError,
  normalizePath,
} from '@juststore/shared';
import { getDriveClient } from './client.js';
import { resolvePath } from './resolver.js';
import { invalidateCachedPath } from './cache.js';
import { logActivity } from '../logger/index.js';

export async function listFiles(drivePath: string): Promise<DriveFile[]> {
  const drive = await getDriveClient();
  const parentId = await resolvePath(drivePath);

  const response = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    fields: `files(${DRIVE_FIELDS})`,
    spaces: 'drive',
    orderBy: 'name',
  });

  return (response.data.files || []) as DriveFile[];
}

export const SHARE_ROLES = ['reader', 'commenter', 'writer', 'owner'] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];

export async function uploadFile(
  localPath: string,
  drivePath?: string,
  name?: string,
  resolvedParentId?: string,
): Promise<DriveFile> {
  const drive = await getDriveClient();
  const fileName = name || path.basename(localPath);
  const parentId = resolvedParentId ?? (await resolvePath(drivePath ?? ''));

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      body: fs.createReadStream(localPath),
    },
    fields: DRIVE_FIELDS,
  });

  const file = response.data as DriveFile;
  await logActivity({
    operation: 'upload',
    path: `${drivePath ? normalizePath(drivePath) : ''}/${fileName}`.replace(/^\//, ''),
    driveFileId: file.id,
    bytes: Number(file.size) || undefined,
    status: 'success',
  });

  return file;
}

export async function downloadFile(
  drivePath: string,
  localPath?: string,
): Promise<string> {
  const drive = await getDriveClient();
  const fileId = await resolvePath(drivePath);
  const fileName = path.basename(normalizePath(drivePath));
  const destPath = localPath || fileName;

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  );

  // pipeline resolves only once the file is fully flushed to disk, and
  // propagates errors from either side.
  try {
    await pipeline(response.data, fs.createWriteStream(destPath));
  } catch (error) {
    await fs.promises.rm(destPath, { force: true });
    throw error;
  }

  await logActivity({
    operation: 'download',
    path: normalizePath(drivePath),
    driveFileId: fileId,
    status: 'success',
  });
  return destPath;
}

export async function ensureDirectory(drivePath: string): Promise<string> {
  try {
    return await resolvePath(drivePath);
  } catch (error) {
    if (!(error instanceof PathNotFoundError)) throw error;
    const created = await createDirectory(drivePath);
    return created.id;
  }
}

export async function createDirectory(drivePath: string): Promise<DriveFile> {
  const drive = await getDriveClient();
  const normalized = normalizePath(drivePath);
  const parts = normalized.split('/');
  const dirName = parts.pop()!;
  const parentPath = parts.join('/');
  const parentId = await resolvePath(parentPath);

  const response = await drive.files.create({
    requestBody: {
      name: dirName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: DRIVE_FIELDS,
  });

  const folder = response.data as DriveFile;
  await logActivity({
    operation: 'mkdir',
    path: normalized,
    driveFileId: folder.id,
    status: 'success',
  });

  return folder;
}

export async function moveFile(
  sourcePath: string,
  destPath: string,
): Promise<DriveFile> {
  const drive = await getDriveClient();
  const fileId = await resolvePath(sourcePath);
  const normalizedDest = normalizePath(destPath);
  const destParts = normalizedDest.split('/');
  const newName = destParts.pop()!;
  const destParentPath = destParts.join('/');
  const newParentId = await resolvePath(destParentPath);

  const getResponse = await drive.files.get({
    fileId,
    fields: 'parents',
  });
  const previousParents = getResponse.data.parents?.join(',') || '';

  const response = await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: previousParents,
    requestBody: { name: newName },
    fields: DRIVE_FIELDS,
  });

  const file = response.data as DriveFile;
  await invalidateCachedPath(normalizePath(sourcePath), fileId);
  await logActivity({
    operation: 'mv',
    path: `${normalizePath(sourcePath)} -> ${normalizedDest}`,
    driveFileId: fileId,
    status: 'success',
  });

  return file;
}

export async function removeFile(
  drivePath: string,
  options: { permanent?: boolean } = {},
): Promise<void> {
  const normalized = normalizePath(drivePath);
  if (!normalized) {
    throw new JustStoreError('Refusing to remove the juststore root folder', 'INVALID_PATH');
  }

  const drive = await getDriveClient();
  const fileId = await resolvePath(normalized);

  if (options.permanent) {
    await drive.files.delete({ fileId });
  } else {
    await drive.files.update({ fileId, requestBody: { trashed: true } });
  }
  await invalidateCachedPath(normalized, fileId);

  await logActivity({
    operation: 'rm',
    path: normalized,
    driveFileId: fileId,
    status: 'success',
    detail: options.permanent ? 'Deleted permanently' : 'Moved to trash',
  });
}

export async function shareFile(
  drivePath: string,
  email?: string,
  role: string = 'reader',
): Promise<string> {
  if (!SHARE_ROLES.includes(role as ShareRole)) {
    throw new JustStoreError(`Invalid role "${role}". Use one of: ${SHARE_ROLES.join(', ')}`, 'INVALID_ROLE');
  }
  if (role === 'owner' && !email) {
    throw new JustStoreError('Transferring ownership requires --email', 'INVALID_ROLE');
  }

  const drive = await getDriveClient();
  const fileId = await resolvePath(drivePath);

  if (email) {
    await drive.permissions.create({
      fileId,
      // Drive rejects role=owner unless the transfer is explicit.
      transferOwnership: role === 'owner' ? true : undefined,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email,
      },
    });
  }

  const response = await drive.files.get({
    fileId,
    fields: 'webViewLink',
  });

  const link = response.data.webViewLink || '';

  await logActivity({
    operation: 'share',
    path: normalizePath(drivePath),
    driveFileId: fileId,
    status: 'success',
    detail: email ? `Shared with ${email} (${role})` : 'Link shared',
  });

  return link;
}
