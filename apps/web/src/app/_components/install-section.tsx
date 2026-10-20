import { InstallCommand } from "#/components/shared/install-command";
import { TerminalCard } from "#/components/shared/terminal-card";

export function InstallSection() {
  return (
    <section id="install" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold text-neutral-50">Install</h2>
      <p className="mt-2 max-w-xl text-sm text-neutral-400">
        One command installs justdrive. Then sign the machine in with a device
        code.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <TerminalCard title="install">
          <p className="text-xs">
            <span className="text-neutral-500">$</span> <InstallCommand />
          </p>
        </TerminalCard>
        <TerminalCard title="sign in">
          <p className="text-xs">
            <span className="text-neutral-500">$</span> justdrive login
          </p>
        </TerminalCard>
      </div>
    </section>
  );
}
