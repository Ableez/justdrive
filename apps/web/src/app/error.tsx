'use client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        This page could not be loaded. Try again, and if it keeps failing, check the server logs.
      </p>
      {error.digest ? (
        <p className="mb-4 font-mono text-xs text-zinc-500">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
