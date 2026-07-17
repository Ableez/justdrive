import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApp: any = {
  use: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  listen: vi.fn(),
};

vi.mock('express', () => {
  const express: any = vi.fn(() => mockApp);
  express.static = vi.fn(() => vi.fn());
  express.json = vi.fn(() => vi.fn());
  return { default: express };
});

vi.mock('multer', () => {
  return {
    default: vi.fn(() => ({
      single: vi.fn(() => vi.fn()),
    })),
  };
});

vi.mock('@juststore/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@juststore/shared')>();
  return {
    ...actual,
    findAvailablePort: vi.fn().mockResolvedValue(4000),
  };
});

vi.mock('../drive/operations.js', () => ({
  listFiles: vi.fn(),
  uploadFile: vi.fn(),
  removeFile: vi.fn(),
  shareFile: vi.fn(),
}));

vi.mock('../auth/tokens.js', () => ({
  loadTokens: vi.fn(),
  saveTokens: vi.fn(),
}));

vi.mock('../drive/cache.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../drive/client.js', () => ({
  getUserEmail: vi.fn(),
  createOAuth2Client: vi.fn(),
}));

vi.mock('../logger/index.js', () => ({
  getActivityLog: vi.fn(),
}));

import { createDashboardServer, startDashboard } from './index.js';

describe('server/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDashboardServer', () => {
    it('creates express app with routes', () => {
      const app = createDashboardServer();
      expect(app).toBeDefined();
      expect(app.use).toHaveBeenCalled();
      // Check that API routes are registered
      const getRoutes = mockApp.get.mock.calls.map((c: any[]) => c[0]);
      const postRoutes = mockApp.post.mock.calls.map((c: any[]) => c[0]);
      expect(getRoutes).toContain('/api/files');
      expect(getRoutes).toContain('/api/activity');
      expect(getRoutes).toContain('/api/status');
      expect(getRoutes).toContain('/oauth2callback');
      expect(postRoutes).toContain('/api/upload');
    });
  });

  describe('startDashboard', () => {
    it('starts server on available port', async () => {
      mockApp.listen.mockImplementation((_port: number, cb: () => void) => {
        cb();
        return { close: vi.fn() };
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await startDashboard();

      expect(mockApp.listen).toHaveBeenCalledWith(4000, expect.any(Function));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('4000'));
      logSpy.mockRestore();
    });
  });
});
