import type { deviceAuthRequests } from '#/db/schema';
import { approveDevice, denyDevice } from '../actions';

type Request = typeof deviceAuthRequests.$inferSelect;

export function RequestDetails({ request }: { request: Request }) {
  const suggested = (request.hostname || 'device').slice(0, 60);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Approve only if you just ran <code>justdrive login</code>.
      </p>

      <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">Code</dt>
        <dd className="font-mono">{request.userCode}</dd>
        <dt className="text-muted-foreground">Host</dt>
        <dd>{request.hostname ?? 'unknown'}</dd>
        <dt className="text-muted-foreground">OS</dt>
        <dd>{request.os ?? 'unknown'}</dd>
        <dt className="text-muted-foreground">IP</dt>
        <dd>{request.requestIp ?? 'unknown'}</dd>
        <dt className="text-muted-foreground">CLI</dt>
        <dd>{request.cliVersion ?? 'unknown'}</dd>
        <dt className="text-muted-foreground">Expires</dt>
        <dd>{request.expiresAt.toISOString().slice(11, 19)} UTC</dd>
      </dl>

      <form action={approveDevice} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="user_code" value={request.userCode} />
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Machine name</span>
          <input
            name="device_name"
            defaultValue={suggested}
            maxLength={60}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Approve
        </button>
      </form>

      <form action={denyDevice} className="mt-3">
        <input type="hidden" name="user_code" value={request.userCode} />
        <button
          type="submit"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Deny
        </button>
      </form>
    </div>
  );
}
