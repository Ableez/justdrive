import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { deviceAuthRequests, users } from '#/db/schema';
import { getSessionUserId } from '#/lib/session';
import { AppNav } from '#/components/shared/app-nav';
import { PageHeader } from '#/components/shared/page-header';
import { RequestDetails } from './_components/request-details';
import { CodeForm } from './_components/code-form';

const ERRORS: Record<string, string> = {
  'bad-code': 'That code is not valid.',
  expired: 'That code has expired or was already used. Run justdrive login again.',
  slow: 'Too many attempts. Wait a minute.',
};

export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string; error?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login?next=/device');
  const db = getDb();
  const { user_code: userCode, error } = await searchParams;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  const pending = userCode
    ? await db.query.deviceAuthRequests.findFirst({
        where: and(
          eq(deviceAuthRequests.userCode, userCode),
          eq(deviceAuthRequests.status, 'pending'),
          isNull(deviceAuthRequests.userId),
        ),
      })
    : undefined;

  return (
    <>
      <AppNav email={user?.email ?? ''} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Approve a machine" />
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
            {ERRORS[error] ?? 'Something went wrong.'}
          </p>
        ) : null}

        {pending ? <RequestDetails request={pending} /> : <CodeForm />}
      </main>
    </>
  );
}
