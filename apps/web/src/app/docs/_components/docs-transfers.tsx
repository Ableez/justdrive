import { InlineCode } from '#/components/shared/inline-code';
import { TerminalCard } from '#/components/shared/terminal-card';

export function DocsTransfers() {
  return (
    <>
      <p>
        A transfer moves a file to another machine. The bytes go straight to Google Drive; only the
        note of who should pick them up passes through the server.
      </p>
      <TerminalCard title="send">
        <p>
          <span className="text-neutral-500">$</span> justdrive send report.pdf --to vps-2
        </p>
        <p className="mt-2 text-emerald-400">Sent report.pdf to vps-2.</p>
        <p className="text-neutral-500">Collect it there with: justdrive receive 1a2b3c4d</p>
      </TerminalCard>
      <TerminalCard title="inbox">
        <p>
          <span className="text-neutral-500">$</span> justdrive inbox
        </p>
        <p className="mt-2 text-neutral-300">Id        Name        Size      Sent</p>
        <p className="text-neutral-300">1a2b3c4d  report.pdf  120.4 KB  2026-10-20 21:04</p>
      </TerminalCard>
      <TerminalCard title="receive">
        <p>
          <span className="text-neutral-500">$</span> justdrive receive 1a2b3c4d ./downloads
        </p>
        <p className="mt-2 text-emerald-400">Received report.pdf -&gt; ./downloads/report.pdf</p>
      </TerminalCard>
      <p>
        <InlineCode>justdrive receive</InlineCode> with no id takes everything waiting, and{' '}
        <InlineCode>justdrive receive all</InlineCode> does the same into a chosen directory. A
        transfer waits three days for the other machine to collect it.
      </p>
    </>
  );
}
