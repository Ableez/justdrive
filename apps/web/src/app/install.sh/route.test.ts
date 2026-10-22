import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderInstallScript } from '#/lib/install-script';

const BASE = 'https://justdrive.astexlabs.com';

describe('install script', () => {
  it('points at this deployment and the bundled release', () => {
    const script = renderInstallScript(BASE);
    expect(script).toContain(`curl -fsSL ${BASE}/install.sh | sh`);
    expect(script).toContain('$BASE/r/justdrive.mjs');
    expect(script).toContain('justdrive login');
    expect(script).toContain('set -eu');
  });

  it('is valid POSIX shell', () => {
    const dir = mkdtempSync(join(tmpdir(), 'install-sh-'));
    const file = join(dir, 'install.sh');
    writeFileSync(file, renderInstallScript(BASE));
    expect(() => execFileSync('sh', ['-n', file])).not.toThrow();
  });
});
