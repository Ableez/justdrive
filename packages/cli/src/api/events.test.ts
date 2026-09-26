import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/session.js', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
}));

import { loadSession } from '../config/session.js';
import { forgetSession } from './client.js';
import { sendEvents } from './events.js';
import type { OutboxEvent } from '../logger/outbox.js';

const event: OutboxEvent = {
  id: '11111111-2222-4333-8444-555555555555',
  type: 'upload',
  path: 'a.txt',
  drive_file_id: 'f1',
  bytes: 10,
  status: 'success',
  at: '2026-09-26T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  forgetSession();
  vi.mocked(loadSession).mockResolvedValue({
    version: 1,
    apiUrl: 'https://drive.astexlabs.com',
    accessToken: 'jd_at_a',
    accessExpiresAt: Date.now() + 3_600_000,
    refreshToken: 'jd_rt_a',
    deviceId: 'd1',
    deviceName: 'vps-1',
  });
  process.env.JUSTDRIVE_API_URL = 'https://drive.astexlabs.com';
});

afterEach(() => {
  delete process.env.JUSTDRIVE_API_URL;
  vi.unstubAllGlobals();
});

describe('sendEvents', () => {
  it('does nothing for an empty batch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendEvents([])).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the queue shape onto the API shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accepted: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendEvents([event])).toBe(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://drive.astexlabs.com/api/cli/events');
    expect(init.headers.Authorization).toBe('Bearer jd_at_a');
    expect(JSON.parse(init.body).events[0]).toEqual({
      id: event.id,
      type: 'upload',
      path: 'a.txt',
      drive_file_id: 'f1',
      bytes: 10,
      status: 'success',
      detail: null,
      at: event.at,
    });
  });

  it('turns null for fields the event does not carry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accepted: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendEvents([{ id: 'x', type: 'rm', status: 'error', at: 'now' } as OutboxEvent]);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events[0]).toMatchObject({
      path: null,
      bytes: null,
      detail: null,
    });
  });

  it('raises so the caller can keep the events queued', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(sendEvents([event])).rejects.toThrow(/Request failed/);
  });

  it('goes to the live server url, not the one recorded at login', async () => {
    process.env.JUSTDRIVE_API_URL = 'http://localhost:3000';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accepted: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendEvents([event]);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/cli/events');
  });
});
