import type { deviceAuthRequests } from '#/db/schema';
import { approveDevice, denyDevice } from '../actions';

type Request = typeof deviceAuthRequests.$inferSelect;

export function RequestDetails({ request }: { request: Request }) {
  const suggested = (request.hostname || 'device').slice(0, 60);

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        A machine is asking for access. Only approve this if you just ran{' '}
        <code>justdrive login</code> yourself.
      </p>

      <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-zinc-500">Code</dt>
        <dd className="font-mono">{request.userCode}</dd>
        <dt className="text-zinc-500">Host</dt>
        <dd>{request.hostname ?? 'unknown'}</dd>
        <dt className="text-zinc-500">OS</dt>
        <dd>{request.os ?? 'unknown'}</dd>
        <dt className="text-zinc-500">IP</dt>
        <dd>{request.requestIp ?? 'unknown'}</dd>
        <dt className="text-zinc-500">CLI</dt>
        <dd>{request.cliVersion ?? 'unknown'}</dd>
        <dt className="text-zinc-500">Expires</dt>
        <dd>{request.expiresAt.toISOString().slice(11, 19)} UTC</dd>
      </dl>

      <form action={approveDevice} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="user_code" value={request.userCode} />
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Name this machine</span>
          <input
            name="device_name"
            defaultValue={suggested}
            maxLength={60}
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Approve
        </button>
      </form>

      <form action={denyDevice} className="mt-3">
        <input type="hidden" name="user_code" value={request.userCode} />
        <button type="submit" className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Deny
        </button>
      </form>
    </div>
  );
}
