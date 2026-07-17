import { describe, it, expect, vi } from 'vitest';

vi.mock('ora', () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  };
  return {
    default: vi.fn(() => mockSpinner),
  };
});

import { withProgress } from './progress.js';
import ora from 'ora';

describe('output/progress', () => {
  it('starts spinner, succeeds on completion', async () => {
    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn(),
      fail: vi.fn(),
    };
    vi.mocked(ora).mockReturnValue(mockSpinner as never);

    const result = await withProgress('Loading...', async () => 'done');

    expect(result).toBe('done');
    expect(ora).toHaveBeenCalledWith('Loading...');
    expect(mockSpinner.start).toHaveBeenCalled();
    expect(mockSpinner.succeed).toHaveBeenCalled();
    expect(mockSpinner.fail).not.toHaveBeenCalled();
  });

  it('starts spinner, fails on error', async () => {
    const mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn(),
      fail: vi.fn(),
    };
    vi.mocked(ora).mockReturnValue(mockSpinner as never);

    await expect(
      withProgress('Loading...', async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow('failed');

    expect(mockSpinner.start).toHaveBeenCalled();
    expect(mockSpinner.succeed).not.toHaveBeenCalled();
    expect(mockSpinner.fail).toHaveBeenCalled();
  });
});
