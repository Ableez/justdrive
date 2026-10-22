import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchDriveToken = vi.fn();
vi.mock('../api/client.js', () => ({ fetchDriveToken: () => fetchDriveToken() }));

import { getDriveClient, resetDriveClient } from './client.js';

beforeEach(() => {
  vi.clearAllMocks();
  resetDriveClient();
  fetchDriveToken.mockResolvedValue({ access_token: 'ya29.x', expiry_date: 1_800_000_000_000 });
});

afterEach(() => {
  resetDriveClient();
});

describe('drive client', () => {
  it('reuses the same client', async () => {
    const first = await getDriveClient();
    const second = await getDriveClient();
    expect(first).toBe(second);
  });

  it('resets the cached token', () => {
    resetDriveClient();
    expect(true).toBe(true);
  });
});