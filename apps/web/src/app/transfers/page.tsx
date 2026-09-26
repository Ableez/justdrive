import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { devices, transfers, users } from '#/db/schema';
import { getSessionUserId } from '#/lib/session';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';

export default async function TransfersPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/transfers');
  const db = getDb();

  const [user, rows] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db
      .select({ transfer: transfers, from: devices.name, to: devices.name })
      .from(transfers)
      .leftJoin(devices, eq(devices.id, transfers.fromDeviceId))
      .leftJoin(devices, eq(devices.id, transfers.toDeviceId))
      .where(eq(transfers.userId, userId))
      .orderBy(desc(transfers.createdAt))
      .limit(100),
  ]);

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <PageHeader title="Transfers" />
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Move a file with <code>justdrive send ./file --to vps-2</code>, then collect it on the other
          machine with <code>justdrive receive</code>.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No transfers yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 font-normal">When</th>
                <th className="py-2 font-normal">File</th>
                <th className="py-2 font-normal">From</th>
                <th className="py-2 font-normal">To</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map(({ transfer, from, to }) => (
                <tr key={transfer.id}>
                  <td className="py-2 whitespace-nowrap text-zinc-500">
                    {transfer.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2 break-all">{transfer.name}</td>
                  <td className="py-2">{from ?? 'unknown'}</td>
                  <td className="py-2">{to ?? 'unknown'}</td>
                  <td className="py-2">{transfer.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
