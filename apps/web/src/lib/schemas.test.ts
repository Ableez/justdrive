import { describe, expect, it } from 'vitest';
import { createTransferSchema, eventsRequestSchema } from './schemas';

const event = { type: 'upload' as const, status: 'success' as const };

describe('createTransferSchema', () => {
  it('accepts a plain file name', () => {
    expect(createTransferSchema.safeParse({ drive_file_id: 'f1', name: 'db.tar.gz', to: 'vps-2' }).success).toBe(true);
  });

  it('rejects names that would escape the download directory', () => {
    for (const name of [
      '../../../home/victim/.ssh/authorized_keys',
      '/etc/passwd',
      'dir/file.txt',
      'dir\\file.txt',
      '..',
      '.',
    ]) {
      expect(createTransferSchema.safeParse({ drive_file_id: 'f1', name, to: 'vps-2' }).success).toBe(
        false,
      );
    }
  });

  it('rejects a size the column cannot hold', () => {
    expect(
      createTransferSchema.safeParse({
        drive_file_id: 'f1',
        name: 'big.iso',
        to: 'vps-2',
        bytes: 2_147_483_648,
      }).success,
    ).toBe(false);
  });
});

describe('eventsRequestSchema', () => {
  it('rejects a size the column cannot hold', () => {
    expect(
      eventsRequestSchema.safeParse({ events: [{ ...event, bytes: Number.MAX_SAFE_INTEGER }] }).success,
    ).toBe(false);
  });

  it('will not let a client report a server-only event type', () => {
    for (const type of ['device_token_reuse', 'google_connected', 'device_approved']) {
      expect(eventsRequestSchema.safeParse({ events: [{ ...event, type }] }).success).toBe(false);
    }
  });

  it('caps the batch size', () => {
    const events = Array.from({ length: 201 }, () => event);
    expect(eventsRequestSchema.safeParse({ events }).success).toBe(false);
  });
});
