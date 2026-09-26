import type { ActivityLogEntry, DriveFile } from '@juststore/shared';

const BASE_URL = '';
const SESSION_HEADER = 'X-Justdrive-Session';
const SESSION_STORAGE_KEY = 'justdrive.session';

let sessionToken: string | null = null;

/**
 * `justdrive dashboard` prints a URL like `/#session=<key>`. Move the key out
 * of the address bar (so it isn't bookmarked or screen-shared) into
 * sessionStorage, which survives reloads but not closing the tab.
 */
export function initSession(): void {
  const match = window.location.hash.match(/(?:^#|&)session=([^&]+)/);
  if (match) {
    sessionToken = decodeURIComponent(match[1]);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionToken);
    } catch {
      // Storage may be blocked; the in-memory key still works until reload.
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return;
  }
  try {
    sessionToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    sessionToken = null;
  }
}

function withSession(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (sessionToken) headers.set(SESSION_HEADER, sessionToken);
  return { ...init, headers };
}

export async function fetchActivity(): Promise<ActivityLogEntry[]> {
  const response = await fetch(`${BASE_URL}/api/activity`, withSession());
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
  const response = await fetch(url, withSession());
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

  const response = await fetch(`${BASE_URL}/api/upload`, withSession({
    method: 'POST',
    body: formData,
  }));

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return response.json();
}

export async function deleteFile(filePath: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/files`, withSession({
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  }));

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
  const response = await fetch(`${BASE_URL}/api/share`, withSession({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, email, role }),
  }));

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
  fullAccess?: boolean;
}> {
  const response = await fetch(`${BASE_URL}/api/status`, withSession());
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch status' }));
    throw new Error(err.error || 'Failed to fetch status');
  }
  return response.json();
}
