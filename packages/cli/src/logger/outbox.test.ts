import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { flush, pendingCount, queueEvent, type OutboxEvent } from './outbox.js';

const sendEvents = vi.fn();
vi.mock('../api/events.js', () => ({ sendEvents: (events: OutboxEvent[]) => sendEvents(events) }));

let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'justdrive-outbox-'));
  process.env.JUSTDRIVE_CONFIG_DIR = home;
  sendEvents.mockReset();
  sendEvents.mockResolvedValue(0);
});

afterEach(async () => {
  delete process.env.JUSTDRIVE_CONFIG_DIR;
  await fs.rm(home, { recursive: true, force: true });
});

describe('event outbox', () => {
  it('queues an event with a client-generated id', async () => {
    const event = await queueEvent({ type: 'upload', path: 'a.txt', status: 'success' });

    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await pendingCount()).toBe(1);
  });

  it('keeps a supplied id so a replay stays the same row', async () => {
    const id = '11111111-2222-4333-8444-555555555555';
    await queueEvent({ id, type: 'rm', path: 'b.txt', status: 'success' });

    sendEvents.mockResolvedValue(1);
    await flush();
    expect(sendEvents.mock.calls[0][0][0].id).toBe(id);
  });

  it('removes the events the server accepted', async () => {
    await queueEvent({ type: 'upload', path: 'a.txt', status: 'success' });
    await queueEvent({ type: 'download', path: 'b.txt', status: 'success' });

    sendEvents.mockResolvedValue(1);
    const result = await flush();

    expect(result).toEqual({ sent: 1, remaining: 1 });
    expect(await pendingCount()).toBe(1);
  });

  it('keeps everything queued when the server is unreachable', async () => {
    await queueEvent({ type: 'upload', path: 'a.txt', status: 'success' });
    sendEvents.mockRejectedValue(new Error('network down'));

    await expect(flush()).rejects.toThrow('network down');
    expect(await pendingCount()).toBe(1);
  });

  it('does nothing when there is nothing queued', async () => {
    expect(await flush()).toEqual({ sent: 0, remaining: 0 });
    expect(sendEvents).not.toHaveBeenCalled();
  });

  it('caps the queue so a long offline stretch cannot grow without bound', async () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({
      id: crypto.randomUUID(),
      type: 'upload' as const,
      path: `f${i}`,
      status: 'success' as const,
      at: new Date().toISOString(),
    }));
    await fs.mkdir(home, { recursive: true });
    await fs.writeFile(path.join(home, 'outbox.json'), JSON.stringify(many));

    await queueEvent({ type: 'upload', path: 'newest', status: 'success' });

    expect(await pendingCount()).toBe(2000);
  });
});
