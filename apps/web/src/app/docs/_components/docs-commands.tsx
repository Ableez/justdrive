import { CommandList } from '#/components/shared/command-list';

export function DocsCommands() {
  return (
    <>
      <p>Every command takes --help for its own options.</p>
      <div className="mt-6">
        <CommandList />
      </div>
    </>
  );
}
