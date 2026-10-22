'use client';

import { useState } from 'react';
import type { Device } from '#/db/schema';

function describeFailure(response: Response): string | null {
  if (response.status === 401 || response.status === 403) {
    window.location.href = '/login';
    return null;
  }
  return response.status === 409 ? 'Name already in use' : 'Could not save';
}

export function DeviceRow({ device }: { device: Device }) {
  const [name, setName] = useState(device.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function rename() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        setMessage(describeFailure(response) ?? '');
        return;
      }
      setMessage('Saved');
    } catch {
      setMessage('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm(`Revoke ${device.name}? It stops getting Drive access right away.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/devices/${device.id}`, { method: 'DELETE' });
      if (response.ok) {
        location.reload();
        return;
      }
      setMessage(describeFailure(response) ?? '');
    } catch {
      setMessage('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <input
        aria-label={`Name for ${device.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={Boolean(device.revokedAt) || busy}
        className="w-48 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <span className="text-sm text-muted-foreground">
        {device.hostname ?? 'unknown'} · {device.os ?? 'unknown'}
      </span>
      <span className="text-xs text-muted-foreground">
        {device.revokedAt
          ? 'revoked'
          : device.lastSeenAt
            ? `seen ${device.lastSeenAt.toISOString().slice(0, 16).replace('T', ' ')}`
            : 'never seen'}
      </span>
      <span className="ml-auto flex items-center gap-3 text-sm">
        {message ? <span className="text-muted-foreground">{message}</span> : null}
        {!device.revokedAt ? (
          <>
            <button
              type="button"
              onClick={rename}
              disabled={busy || name === device.name}
              className="text-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              className="text-red-600 underline-offset-4 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              Revoke
            </button>
          </>
        ) : null}
      </span>
    </li>
  );
}
