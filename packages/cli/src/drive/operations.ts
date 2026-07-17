import { drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { DriveFile, DRIVE_FIELDS, normalizePath } from '@juststore/shared';
import { getDriveClient } from './client.js';
import { resolvePath } from './resolver.js';
import { logActivity } from '../logger/index.js';

export async function listFiles(drivePath: string): Promise<DriveFile[]> {
  const drive = await getDriveClient();
  const parentId = drivePath ? await resolvePath(drivePath) : await resolvePath('');

  const response = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    fields: `files(${DRIVE_FIELDS})`,
    spaces: 'drive',
    orderBy: 'name',
  });

  return (response.data.files || []) as DriveFile[];
}

export async function uploadFile(
  localPath: string,
  drivePath?: string,
): Promise<DriveFile> {
  const drive = await getDriveClient();
  const fileName = path.basename(localPath);
  const parentId = drivePath
    ? await resolvePath(drivePath)
    : await resolvePath('');

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
    timestamp: new Date().toISOString(),
    operation: 'upload',
    path: normalizePath(`${drivePath || ''}/${fileName}`),
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

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    response.data
      .on('end', async () => {
        await logActivity({
          timestamp: new Date().toISOString(),
          operation: 'download',
          path: normalizePath(drivePath),
          status: 'success',
        });
        resolve(destPath);
      })
      .on('error', reject)
      .pipe(dest);
  });
}

export async function createDirectory(drivePath: string): Promise<DriveFile> {
  const drive = await getDriveClient();
  const normalized = normalizePath(drivePath);
  const parts = normalized.split('/');
  const dirName = parts.pop()!;
  const parentPath = parts.join('/');
  const parentId = parentPath ? await resolvePath(parentPath) : await resolvePath('');

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
    timestamp: new Date().toISOString(),
    operation: 'mkdir',
    path: normalized,
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
  const newParentId = destParentPath ? await resolvePath(destParentPath) : await resolvePath('');

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
  await logActivity({
    timestamp: new Date().toISOString(),
    operation: 'mv',
    path: `${normalizePath(sourcePath)} -> ${normalizedDest}`,
    status: 'success',
  });

  return file;
}

export async function removeFile(drivePath: string): Promise<void> {
  const drive = await getDriveClient();
  const fileId = await resolvePath(drivePath);

  await drive.files.delete({ fileId });

  await logActivity({
    timestamp: new Date().toISOString(),
    operation: 'rm',
    path: normalizePath(drivePath),
    status: 'success',
  });
}

export async function shareFile(
  drivePath: string,
  email?: string,
  role: string = 'reader',
): Promise<string> {
  const drive = await getDriveClient();
  const fileId = await resolvePath(drivePath);

  if (email) {
    await drive.permissions.create({
      fileId,
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
    timestamp: new Date().toISOString(),
    operation: 'share',
    path: normalizePath(drivePath),
    status: 'success',
    detail: email ? `Shared with ${email} (${role})` : 'Link shared',
  });

  return link;
}
