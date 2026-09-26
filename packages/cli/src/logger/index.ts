import { normalizePath } from '@juststore/shared';
import { flush, queueEvent, type EventType } from './outbox.js';

/**
 * The event is written to the local queue first, then handed to the server
 * without waiting for it.
 *
 * Neither step can fail the caller: the file operation has already gone to
 * Drive, so a full disk or an unreachable server must not turn a completed
 * upload into "Upload failed".
 */
export async function logActivity(entry: {
  operation: EventType;
  path: string;
  driveFileId?: string;
  bytes?: number;
  status: 'success' | 'error';
  detail?: string;
}): Promise<void> {
  try {
    await queueEvent({
      type: entry.operation,
      path: normalizePath(entry.path),
      drive_file_id: entry.driveFileId,
      bytes: entry.bytes,
      status: entry.status,
      detail: entry.detail,
    });
  } catch {
    return;
  }

  void flush().catch(() => {});
}
