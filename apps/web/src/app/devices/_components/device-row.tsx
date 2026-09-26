'use client';

import { useState } from 'react';
import type { Device } from '#/db/schema';

export function DeviceRow({ device }: { device: Device }) {
  const [name, setName] = useState(device.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function rename() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/devices/${device.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    setMessage(response.ok ? 'Saved' : 'Name unavailable');
  }

  async function revoke() {
    if (!confirm(`Revoke ${device.name}? It stops getting Drive access right away.`)) return;
    setBusy(true);
    const response = await fetch(`/api/devices/${device.id}`, { method: 'DELETE' });
    setBusy(false);
    if (response.ok) location.reload();
    else setMessage('Could not revoke');
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <input
        aria-label={`Name for ${device.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={Boolean(device.revokedAt) || busy}
        className="w-48 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {device.hostname ?? 'unknown host'} · {device.os ?? 'unknown os'}
      </span>
      <span className="text-xs text-zinc-500">
        {device.revokedAt
          ? 'revoked'
          : device.lastSeenAt
            ? `seen ${device.lastSeenAt.toISOString().slice(0, 16).replace('T', ' ')}`
            : 'never seen'}
      </span>
      <span className="ml-auto flex items-center gap-3 text-sm">
        {message ? <span className="text-zinc-500">{message}</span> : null}
        {!device.revokedAt ? (
          <>
            <button type="button" onClick={rename} disabled={busy || name === device.name} className="underline">
              Save
            </button>
            <button type="button" onClick={revoke} disabled={busy} className="underline text-red-600 dark:text-red-400">
              Revoke
            </button>
          </>
        ) : null}
      </span>
    </li>
  );
}
