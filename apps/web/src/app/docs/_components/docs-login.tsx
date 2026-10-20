import { baseUrl } from '#/lib/env';
import { InlineCode } from '#/components/shared/inline-code';
import { TerminalCard } from '#/components/shared/terminal-card';

export function DocsLogin() {
  return (
    <>
      <p>
        Every machine signs in with a device code, so a headless server needs neither a browser nor
        your Google password.
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Run <InlineCode>justdrive login</InlineCode> on the machine. Add{' '}
          <InlineCode>--name vps-2</InlineCode> to name it.
        </li>
        <li>
          The terminal prints an approval link and a code like <InlineCode>HJKL-MNPQ</InlineCode>.
        </li>
        <li>
          Open the link in any browser, sign in to your justdrive account, and type the code.
        </li>
        <li>Approve the machine. The terminal confirms the sign-in.</li>
      </ol>
      <TerminalCard title="justdrive login">
        <p>
          <span className="text-neutral-500">$</span> justdrive login --name vps-2
        </p>
        <p className="mt-2 text-neutral-500">Open {baseUrl()}/device</p>
        <p className="text-neutral-500">
          and enter this code if it is not filled in: HJKL-MNPQ
        </p>
        <p className="text-neutral-500">Waiting for approval...</p>
        <p className="mt-2 text-emerald-400">Signed in as vps-2.</p>
      </TerminalCard>
      <p>
        The code is good for 10 minutes, and the CLI checks every 5 seconds while it waits. Approving
        gives that machine its own token, which you can revoke at any time.
      </p>
    </>
  );
}
