import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizePath,
  isAbsolutePath,
  findAvailablePort,
  JustStoreError,
  AuthError,
  PathNotFoundError,
} from './utils.js';
import net from 'net';

vi.mock('net', () => {
  const mockServer = {
    once: vi.fn(),
    listen: vi.fn(),
    close: vi.fn(),
  };
  return {
    default: {
      createServer: vi.fn(() => mockServer),
    },
  };
});

describe('normalizePath', () => {
  it('returns empty string for empty input', () => {
    expect(normalizePath('')).toBe('');
  });

  it('strips leading ./', () => {
    expect(normalizePath('./photos/vacation')).toBe('photos/vacation');
  });

  it('strips leading .', () => {
    expect(normalizePath('.photos')).toBe('photos');
  });

  it('strips leading juststore/', () => {
    expect(normalizePath('juststore/photos/vacation')).toBe('photos/vacation');
  });

  it('strips leading juststore without slash', () => {
    expect(normalizePath('juststorephotos')).toBe('photos');
  });

  it('strips trailing slashes', () => {
    expect(normalizePath('photos/vacation/')).toBe('photos/vacation');
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizePath('photos/vacation///')).toBe('photos/vacation');
  });

  it('handles path with both prefix and trailing slash', () => {
    expect(normalizePath('./juststore/photos/vacation/')).toBe('photos/vacation');
  });

  it('returns plain path unchanged', () => {
    expect(normalizePath('photos/2024/vacation.jpg')).toBe('photos/2024/vacation.jpg');
  });

  it('handles single segment', () => {
    expect(normalizePath('photos')).toBe('photos');
  });

  it('handles juststore prefix without additional path', () => {
    expect(normalizePath('juststore/')).toBe('');
  });
});

describe('isAbsolutePath', () => {
  it('returns true for absolute path', () => {
    expect(isAbsolutePath('/Users/test')).toBe(true);
  });

  it('returns true for root only', () => {
    expect(isAbsolutePath('/')).toBe(true);
  });

  it('returns false for relative path', () => {
    expect(isAbsolutePath('photos/test')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAbsolutePath('')).toBe(false);
  });

  it('returns false for dot-relative path', () => {
    expect(isAbsolutePath('./photos')).toBe(false);
  });
});

describe('findAvailablePort', () => {
  let mockServer: ReturnType<typeof createMockServer>;

  function createMockServer() {
    const server = {
      once: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
    };
    (net.createServer as ReturnType<typeof vi.fn>).mockReturnValue(server);
    return server;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the default port when available', async () => {
    mockServer = createMockServer();
    mockServer.once.mockImplementation((event: string, cb: () => void) => {
      if (event === 'listening') cb();
    });

    const port = await findAvailablePort();
    expect(port).toBe(4000);
    expect(mockServer.listen).toHaveBeenCalledWith(4000);
    expect(mockServer.close).toHaveBeenCalled();
  });

  it('increments port when first port is occupied', async () => {
    mockServer = createMockServer();
    let callCount = 0;
    mockServer.once.mockImplementation((event: string, cb: (err?: Error) => void) => {
      if (event === 'error' && callCount === 0) {
        callCount++;
        cb(new Error('EADDRINUSE'));
      } else if (event === 'listening') {
        cb();
      }
    });

    const port = await findAvailablePort(4000);
    expect(port).toBe(4001);
  });

  it('throws when all ports in range are occupied', async () => {
    mockServer = createMockServer();
    mockServer.once.mockImplementation((event: string, cb: (err?: Error) => void) => {
      if (event === 'error') {
        cb(new Error('EADDRINUSE'));
      }
    });

    await expect(findAvailablePort(4000)).rejects.toThrow(
      'No available port found in range 4000-4100',
    );
  });

  it('accepts custom start port', async () => {
    mockServer = createMockServer();
    mockServer.once.mockImplementation((event: string, cb: () => void) => {
      if (event === 'listening') cb();
    });

    const port = await findAvailablePort(8080);
    expect(port).toBe(8080);
    expect(mockServer.listen).toHaveBeenCalledWith(8080);
  });
});

describe('error classes', () => {
  describe('JustStoreError', () => {
    it('has correct name and message', () => {
      const error = new JustStoreError('test error', 'TEST_CODE');
      expect(error.name).toBe('JustStoreError');
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('is an instance of Error', () => {
      const error = new JustStoreError('test', 'CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(JustStoreError);
    });
  });

  describe('AuthError', () => {
    it('has correct name, message, and code', () => {
      const error = new AuthError('auth failed');
      expect(error.name).toBe('AuthError');
      expect(error.message).toBe('auth failed');
      expect(error.code).toBe('AUTH_ERROR');
    });

    it('is an instance of JustStoreError', () => {
      const error = new AuthError('auth failed');
      expect(error).toBeInstanceOf(JustStoreError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('PathNotFoundError', () => {
    it('formats message with path', () => {
      const error = new PathNotFoundError('/photos/missing');
      expect(error.name).toBe('PathNotFoundError');
      expect(error.message).toBe('Path not found: /photos/missing');
      expect(error.code).toBe('PATH_NOT_FOUND');
    });

    it('is an instance of JustStoreError', () => {
      const error = new PathNotFoundError('/test');
      expect(error).toBeInstanceOf(JustStoreError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
