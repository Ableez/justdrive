import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { googleConnections, users } from '#/db/schema';
import { getSessionUserId } from '#/lib/session';
import { disconnectGoogle } from '#/app/_actions/google';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';
import { DangerZone } from './_components/danger-zone';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ disconnected?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/settings');
  const db = getDb();
  const { disconnected } = await searchParams;

  const [user, connection] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.googleConnections.findFirst({ where: eq(googleConnections.userId, userId) }),
  ]);

  const connected = connection?.status === 'active';

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Settings" />
        {disconnected ? (
          <p className="mb-4 text-sm text-green-700 dark:text-green-500">Google Drive disconnected.</p>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-2 font-medium">Google Drive</h2>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {connected
              ? 'Connected. Machines get short-lived Drive access from this connection.'
              : 'Not connected. Reconnect to let machines use Drive.'}
          </p>
          {connected ? (
            <form action={disconnectGoogle}>
              <button type="submit" className="text-sm underline text-red-600 dark:text-red-400">
                Disconnect Google Drive
              </button>
            </form>
          ) : (
            <a
              href="/auth/google"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Connect Google Drive
            </a>
          )}
        </section>

        <DangerZone />
      </main>
    </>
  );
}
