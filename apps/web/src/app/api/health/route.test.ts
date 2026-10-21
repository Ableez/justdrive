import { describe, expect, it } from 'vitest';
import pkg from '../../../../package.json';
import { GET } from './route';

describe('health route', () => {
  it('reports ok with the deployed version and no database call', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, version: pkg.version });
  });
});
