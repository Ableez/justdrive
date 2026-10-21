import { InlineCode } from '#/components/shared/inline-code';
import { InstallCommand } from '#/components/shared/install-command';
import { TerminalCard } from '#/components/shared/terminal-card';

export function DocsInstall() {
  return (
    <>
      <p>justdrive is one file. Install it with a single command:</p>
      <TerminalCard title="install">
        <p>
          <span className="text-neutral-500">$</span> <InstallCommand />
        </p>
      </TerminalCard>
      <p>
        It needs Node 20 or newer. The installer writes to <InlineCode>~/.local/bin</InlineCode>, so
        put that directory on your PATH, or set <InlineCode>JUSTDRIVE_BIN_DIR</InlineCode> first.
      </p>
      <p>
        Then sign the machine in with <InlineCode>justdrive login</InlineCode>.
      </p>
    </>
  );
}
