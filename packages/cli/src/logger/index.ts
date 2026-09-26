import { normalizePath } from '@juststore/shared';
import { flush, queueEvent, type EventType } from './outbox.js';

/**
 * The event is written to the local queue first, then handed to the server
 * without waiting for it: the file operation already went to Drive, and an
 * unreachable server must not fail or delay the transfer.
 */
export async function logActivity(entry: {
  operation: EventType;
  path: string;
  driveFileId?: string;
  bytes?: number;
  status: 'success' | 'error';
  detail?: string;
}): Promise<void> {
  await queueEvent({
    type: entry.operation,
    path: normalizePath(entry.path),
    drive_file_id: entry.driveFileId,
    bytes: entry.bytes,
    status: entry.status,
    detail: entry.detail,
  });

  void flush().catch(() => {});
}
