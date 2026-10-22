'use client';

import { useState } from 'react';
import { deleteAccount } from '#/app/_actions/google';

export function DangerZone() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Delete account</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Revokes Google access and erases devices, history, transfers.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
        >
          Delete account
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">Delete account</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Irreversible. Files already in Drive stay.
      </p>
      <form action={deleteAccount} className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
        >
          Delete everything
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Cancel
        </button>
      </form>
    </section>
  );
}
