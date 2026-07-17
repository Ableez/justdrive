import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CONFIG_DIR, ACTIVITY_LOG_FILE, ActivityLogEntry } from '@juststore/shared';

function getLogPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, ACTIVITY_LOG_FILE);
}

export async function logActivity(entry: ActivityLogEntry): Promise<void> {
  const logPath = getLogPath();
  await fs.mkdir(path.dirname(logPath), { recursive: true });

  let entries: ActivityLogEntry[] = [];
  try {
    const raw = await fs.readFile(logPath, 'utf-8');
    entries = JSON.parse(raw);
  } catch {
    // File doesn't exist yet
  }

  entries.push(entry);
  await fs.writeFile(logPath, JSON.stringify(entries, null, 2));
}

export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  try {
    const raw = await fs.readFile(getLogPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
