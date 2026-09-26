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

  it('drops a batch the server fully accepted', async () => {
    await queueEvent({ type: 'upload', path: 'a.txt', status: 'success' });
    await queueEvent({ type: 'download', path: 'b.txt', status: 'success' });

    sendEvents.mockResolvedValue(2);
    const result = await flush();

    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(await pendingCount()).toBe(0);
  });

  it('keeps the whole batch when the server accepted only part of it', async () => {
    await queueEvent({ type: 'upload', path: 'a.txt', status: 'success' });
    await queueEvent({ type: 'download', path: 'b.txt', status: 'success' });

    // The count says how many rows exist, not which of ours they were, so a
    // partial batch must not be trimmed from the front.
    sendEvents.mockResolvedValue(1);
    const result = await flush();

    expect(result).toEqual({ sent: 1, remaining: 2 });
    expect(await pendingCount()).toBe(2);
  });

  it('refuses to trim the queue on an unusable accepted count', async () => {
    await queueEvent({ type: 'upload', path: 'a.txt', status: 'success' });

    sendEvents.mockResolvedValue(99);
    await expect(flush()).rejects.toThrow(/accepted count/);
    expect(await pendingCount()).toBe(1);
  });

  it('does not lose an event queued while a flush was in flight', async () => {
    let release: () => void = () => {};
    sendEvents.mockImplementation(
      () => new Promise<number>((resolve) => { release = () => resolve(1); }),
    );

    await queueEvent({ type: 'upload', path: 'first.txt', status: 'success' });
    const flushing = flush();
    await Promise.resolve();

    await queueEvent({ type: 'download', path: 'second.txt', status: 'success' });
    release();
    await flushing;

    // Without serialised access the first flush rewrites the file from the
    // snapshot it took before the network call, discarding the second event.
    const remaining = await pendingCount();
    expect(remaining).toBe(1);

    const { readFile } = await import('fs/promises');
    const kept = JSON.parse(await readFile(path.join(home, 'outbox.json'), 'utf-8'));
    expect(kept[0].path).toBe('second.txt');
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
