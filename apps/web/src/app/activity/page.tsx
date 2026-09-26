import { and, desc, eq, type SQL } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getDb } from '#/db/client';
import { devices, events, users, type EventType } from '#/db/schema';
import { getSessionUserId } from '#/lib/session';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';
import { EventFilters } from './_components/event-filters';

const PAGE_SIZE = 100;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; device?: string; page?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/activity');
  const db = getDb();
  const params = await searchParams;

  const deviceList = await db
    .select({ id: devices.id, name: devices.name })
    .from(devices)
    .where(eq(devices.userId, userId));

  const filters: SQL[] = [eq(events.userId, userId)];
  if (params.type) filters.push(eq(events.type, params.type as EventType));
  if (params.device) filters.push(eq(events.deviceId, params.device));

  const [user, rows] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db
      .select({ event: events, deviceName: devices.name })
      .from(events)
      .leftJoin(devices, eq(devices.id, events.deviceId))
      .where(and(...filters))
      .orderBy(desc(events.at))
      .limit(PAGE_SIZE),
  ]);

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <PageHeader title="Activity" />
        <EventFilters deviceList={deviceList} current={params} />

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No matching events.</p>
        ) : (
          <table className="mt-6 w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 font-normal">When</th>
                <th className="py-2 font-normal">Type</th>
                <th className="py-2 font-normal">Path</th>
                <th className="py-2 font-normal">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map(({ event, deviceName }) => (
                <tr key={event.id}>
                  <td className="py-2 whitespace-nowrap text-zinc-500">
                    {event.at.toISOString().slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2 font-mono">{event.type}</td>
                  <td className="py-2 break-all">{event.path ?? event.detail ?? ''}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{deviceName ?? 'server'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
