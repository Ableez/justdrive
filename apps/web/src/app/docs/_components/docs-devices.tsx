import { baseUrl } from '#/lib/env';
import { InlineCode } from '#/components/shared/inline-code';
import { TerminalCard } from '#/components/shared/terminal-card';

export function DocsDevices() {
  return (
    <>
      <p>
        Each machine keeps its own token. <InlineCode>justdrive devices</InlineCode> lists the
        machines signed in to your account.
      </p>
      <TerminalCard title="devices">
        <p>
          <span className="text-neutral-500">$</span> justdrive devices
        </p>
        <p className="mt-2 text-neutral-300">Name                   Last seen</p>
        <p className="text-neutral-300">laptop (this machine)   2026-10-20 21:04</p>
        <p className="text-neutral-300">vps-2                  2026-10-19 09:12</p>
        <p className="mt-2 text-neutral-500">Revoke a machine at {baseUrl()}/devices</p>
      </TerminalCard>
      <p>
        Revoking a machine on the website cuts off its Drive access right away. To sign this machine
        out, run <InlineCode>justdrive logout</InlineCode>: it revokes the token and deletes the
        local session.
      </p>
    </>
  );
}
