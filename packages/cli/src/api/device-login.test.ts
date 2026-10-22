import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveSession = vi.fn();
const clearSession = vi.fn();
vi.mock('../config/session.js', () => ({
  saveSession: (session: unknown) => saveSession(session),
  clearSession: () => clearSession(),
  loadSession: vi.fn(),
}));

import { completeDeviceLogin, requestDeviceCode, type DeviceCodeResponse } from './device-login.js';

const deviceCode: DeviceCodeResponse = {
  device_code: 'device-code-abc',
  user_code: 'BCDF-GHJK',
  verification_uri: 'https://justdrive.astexlabs.com/device',
  verification_uri_complete: 'https://justdrive.astexlabs.com/device?user_code=BCDF-GHJK',
  expires_in: 600,
  interval: 5,
};

const approved = {
  access_token: 'jd_at_a',
  refresh_token: 'jd_rt_a',
  expires_in: 3600,
  device: { id: 'd1', name: 'vps-2' },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Drives the polling loop forward without waiting in real time. */
async function runLogin(code: DeviceCodeResponse, ms = 20_000) {
  let outcome: { ok: boolean; value?: unknown; error?: unknown };
  const settled = completeDeviceLogin(code, {}).then(
    (value) => {
      outcome = { ok: true, value };
    },
    (error) => {
      outcome = { ok: false, error };
    },
  );
  await vi.advanceTimersByTimeAsync(ms);
  await settled;
  if (outcome!.ok) return outcome!.value;
  throw outcome!.error;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JUSTDRIVE_API_URL = 'https://justdrive.astexlabs.com';
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.JUSTDRIVE_API_URL;
});

describe('requestDeviceCode', () => {
  it('sends machine details and returns the verification url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(deviceCode));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestDeviceCode({ hostname: 'vps-2', os: 'linux', cliVersion: '0.2.0' });

    expect(result.user_code).toBe('BCDF-GHJK');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      hostname: 'vps-2',
      os: 'linux',
      cli_version: '0.2.0',
    });
  });

  it('reports a server that will not start sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(requestDeviceCode({})).rejects.toThrow(/Could not start sign-in/);
  });

  it('retries a transient failure and returns the code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementation(() => Promise.resolve(jsonResponse(deviceCode)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestDeviceCode({})).resolves.toMatchObject({ user_code: 'BCDF-GHJK' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails fast when the server refuses the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestDeviceCode({})).rejects.toThrow(/Could not start sign-in \(400\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports an unreadable success body instead of a parse error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>nope</html>', { status: 200 })));
    await expect(requestDeviceCode({})).rejects.toThrow(/unreadable response/);
  });

  it('reports a dropped connection without retrying forever', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestDeviceCode({})).rejects.toThrow(/Could not start sign-in/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('completeDeviceLogin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('saves the session once the user approves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(approved)));

    const session = await runLogin(deviceCode);

    expect(session).toMatchObject({
      accessToken: 'jd_at_a',
      refreshToken: 'jd_rt_a',
      deviceId: 'd1',
      deviceName: 'vps-2',
      apiUrl: 'https://justdrive.astexlabs.com',
    });
    expect(saveSession).toHaveBeenCalledWith(session);
  });

  it('keeps polling while the user has not decided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(jsonResponse(approved));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runLogin(deviceCode)).resolves.toMatchObject({ deviceId: 'd1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('backs off after slow_down instead of hammering the server', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'slow_down' }))
      .mockResolvedValueOnce(jsonResponse(approved));
    vi.stubGlobal('fetch', fetchMock);

    const started = Date.now();
    await runLogin(deviceCode);

    // First poll at 5s, then a 5s penalty before the next.
    expect(Date.now() - started).toBeGreaterThanOrEqual(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops on a denial', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'access_denied' })));
    await expect(runLogin(deviceCode)).rejects.toThrow(/denied/);
  });

  it('stops when the code expires', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'expired_token' })));
    await expect(runLogin(deviceCode)).rejects.toThrow(/expired/);
  });

  it('gives up when the deadline passes with no answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'authorization_pending' })),
    );
    await expect(runLogin({ ...deviceCode, expires_in: 10 })).rejects.toThrow(/Timed out/);
  });

  it('recovers when a poll hits a transient server failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementation(() => Promise.resolve(jsonResponse(approved)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runLogin(deviceCode)).resolves.toMatchObject({ deviceId: 'd1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after repeated poll failures instead of hanging', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('', { status: 500 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runLogin(deviceCode)).rejects.toThrow(/unavailable \(500\)/);
    // One poll attempt, retried to exhaustion, then the sign-in fails.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
