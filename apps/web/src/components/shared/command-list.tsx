const commands = [
  { cmd: 'justdrive login [--name vps-2]', desc: 'Sign in this machine using a device code.' },
  { cmd: 'justdrive logout', desc: 'Revoke this machine and delete its local session.' },
  { cmd: 'justdrive status', desc: 'Show the account, this machine, and server reachability.' },
  { cmd: 'justdrive devices', desc: 'List machines signed in to your account.' },
  { cmd: 'justdrive files ls [path]', desc: 'List files. Supports --json.' },
  { cmd: 'justdrive files upload <local> [path]', desc: 'Upload a file.' },
  { cmd: 'justdrive files download <path> [local]', desc: 'Download a file.' },
  { cmd: 'justdrive files mkdir <path>', desc: 'Create a directory.' },
  { cmd: 'justdrive files mv <src> <dest>', desc: 'Move or rename.' },
  { cmd: 'justdrive files rm <path> [--permanent]', desc: 'Move to the Drive trash, or delete outright.' },
  { cmd: 'justdrive share <path> [--email] [--role]', desc: 'Share a file or copy a link.' },
  { cmd: 'justdrive send <file> --to vps-2', desc: 'Upload a file into another machine’s inbox.' },
  { cmd: 'justdrive inbox', desc: 'List files sent to this machine.' },
  { cmd: 'justdrive receive [id|all] [dir]', desc: 'Download and acknowledge them.' },
];

export function CommandList() {
  return (
    <ul className="divide-y divide-neutral-800 border-y border-neutral-800">
      {commands.map((command) => (
        <li
          key={command.cmd}
          className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-8"
        >
          <code className="font-mono text-sm text-neutral-100 sm:w-96 sm:shrink-0">{command.cmd}</code>
          <p className="text-sm text-neutral-400">{command.desc}</p>
        </li>
      ))}
    </ul>
  );
}
