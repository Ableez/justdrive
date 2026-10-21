import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { users } from '#/db/schema';
import { getSessionUserId } from '#/lib/session';
import { listDevices } from '#/lib/devices';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';
import { DeviceRow } from './_components/device-row';

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; denied?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/devices');
  const db = getDb();
  const { approved, denied } = await searchParams;

  const [user, devices] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    listDevices(db, userId),
  ]);

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <PageHeader title="Devices">
          <a href="/device" className="text-sm underline">
            Approve a new machine
          </a>
        </PageHeader>

        {approved ? <p className="mb-4 text-sm text-green-700 dark:text-green-500">Device approved.</p> : null}
        {denied ? <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">Request denied.</p> : null}

        {devices.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No machines yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {devices.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
