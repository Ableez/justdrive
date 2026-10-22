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
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Connect Google Drive once. Approved machines reuse it.
      </p>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <Link
        href={`/auth/google?next=${encodeURIComponent(target)}`}
        className="rounded-md bg-foreground px-4 py-2 text-center text-sm font-medium text-background"
      >
        Continue with Google
      </Link>
    </main>
  );
}
