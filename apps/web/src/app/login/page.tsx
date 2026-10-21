import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '#/lib/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (await getSessionUserId()) redirect('/dashboard');
  const { error, next } = await searchParams;
  const target = next?.startsWith('/') ? next : '/dashboard';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Sign in to justdrive</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Connect your Google Drive once. Machines you approve later use this connection instead of
        signing in to Google themselves.
      </p>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <Link
        href={`/auth/google?next=${encodeURIComponent(target)}`}
        className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Continue with Google
      </Link>
    </main>
  );
}
