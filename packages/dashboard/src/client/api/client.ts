import type { ActivityLogEntry, DriveFile } from '@juststore/shared';

const BASE_URL = '';

export async function fetchActivity(): Promise<ActivityLogEntry[]> {
  const response = await fetch(`${BASE_URL}/api/activity`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch activity' }));
    throw new Error(err.error || 'Failed to fetch activity');
  }
  return response.json();
}

export async function fetchFiles(dirPath: string = ''): Promise<DriveFile[]> {
  const url = dirPath
    ? `${BASE_URL}/api/files?path=${encodeURIComponent(dirPath)}`
    : `${BASE_URL}/api/files`;
  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch files' }));
    throw new Error(err.error || 'Failed to fetch files');
  }
  return response.json();
}

export async function uploadFile(file: File, drivePath?: string): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);
  if (drivePath) formData.append('drivePath', drivePath);

  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return response.json();
}

export async function deleteFile(filePath: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(err.error || 'Delete failed');
  }
}

export async function shareFile(
  filePath: string,
  email?: string,
  role?: string,
): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, email, role }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Share failed' }));
    throw new Error(err.error || 'Share failed');
  }

  const data = await response.json();
  return data.link;
}

export async function fetchStatus(): Promise<{
  authenticated: boolean;
  email?: string;
  expiresAt?: string | null;
}> {
  const response = await fetch(`${BASE_URL}/api/status`);
  if (!response.ok) throw new Error('Failed to fetch status');
  return response.json();
}
