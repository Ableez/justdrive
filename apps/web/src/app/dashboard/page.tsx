import { redirect } from 'next/navigation';
import { getDb } from '#/db/client';
import { getSessionUserId } from '#/lib/session';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { devices, events, transfers, users } from '#/db/schema';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/dashboard');
  const db = getDb();

  const [user, activeDevices, eventCount, pendingTransfers, recent] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.select({ value: count() }).from(devices).where(and(eq(devices.userId, userId), isNull(devices.revokedAt))),
    db.select({ value: count() }).from(events).where(eq(events.userId, userId)),
    db.select({ value: count() }).from(transfers).where(and(eq(transfers.userId, userId), eq(transfers.status, 'pending'))),
    db.select().from(events).where(eq(events.userId, userId)).orderBy(desc(events.at)).limit(10),
  ]);

  const stats = [
    { label: 'Active devices', value: activeDevices[0]?.value ?? 0 },
    { label: 'Events recorded', value: eventCount[0]?.value ?? 0 },
    { label: 'Pending transfers', value: pendingTransfers[0]?.value ?? 0 },
  ];

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <PageHeader title="Overview" />

        <dl className="mb-10 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mb-3 font-medium">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nothing yet. Run <code>justdrive login</code> on a machine, then upload a file.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {recent.map((event) => (
              <li key={event.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="font-mono">{event.type}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{event.path ?? event.detail ?? ''}</span>
                <span className="ml-auto text-zinc-500">{event.at.toISOString().slice(0, 19).replace('T', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
