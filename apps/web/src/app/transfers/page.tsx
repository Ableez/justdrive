import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '#/db/client';
import { devices, transfers, users } from '#/db/schema';
import { getSessionUserId } from '#/lib/session';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';

const toDevice = alias(devices, 'to_device');

export default async function TransfersPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/transfers');
  const db = getDb();

  const [user, rows] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db
      .select({ transfer: transfers, from: devices.name, to: toDevice.name })
      .from(transfers)
      .leftJoin(devices, eq(devices.id, transfers.fromDeviceId))
      .leftJoin(toDevice, eq(toDevice.id, transfers.toDeviceId))
      .where(eq(transfers.userId, userId))
      .orderBy(desc(transfers.createdAt))
      .limit(100),
  ]);

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <PageHeader title="Transfers" />
        <p className="mb-6 text-sm text-muted-foreground">
          Send with <code>justdrive send ./file --to vps-2</code>, then receive on the other machine.
        </p>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No transfers yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">File</th>
                <th className="py-2 font-medium">From</th>
                <th className="py-2 font-medium">To</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ transfer, from, to }) => (
                <tr key={transfer.id} className="hover:bg-muted/40">
                  <td className="py-2.5 whitespace-nowrap text-muted-foreground">
                    {transfer.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2.5 break-all">{transfer.name}</td>
                  <td className="py-2.5">{from ?? 'unknown'}</td>
                  <td className="py-2.5">{to ?? 'unknown'}</td>
                  <td className="py-2.5 text-muted-foreground">{transfer.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
