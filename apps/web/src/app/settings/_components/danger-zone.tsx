'use client';

import { useState } from 'react';
import { deleteAccount } from '#/app/_actions/google';

export function DangerZone() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <section>
        <h2 className="mb-2 font-medium">Delete account</h2>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Revokes Google access and erases your devices, history and transfers.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm underline text-red-600 dark:text-red-400"
        >
          Delete my account
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-2 font-medium text-red-600 dark:text-red-400">Delete account</h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        This cannot be undone. Files already in Drive stay in Drive.
      </p>
      <form action={deleteAccount} className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
        >
          Yes, delete everything
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-sm underline">
          Cancel
        </button>
      </form>
    </section>
  );
}
