import Link from 'next/link';

const features = [
  {
    title: 'Sign in once',
    body: 'Connect Google Drive on the website. Machines you approve later use that one connection instead of signing in to Google themselves.',
  },
  {
    title: 'No browser needed',
    body: 'justdrive login on a headless VPS prints a short code. Approve it from your laptop.',
    code: 'justdrive login',
  },
  {
    title: 'Revoke any machine',
    body: 'Every machine gets its own token. Revoke one and it stops getting Drive access immediately.',
  },
  {
    title: 'Files never touch our servers',
    body: 'Machines get short-lived Google tokens and talk to Drive directly. We only record what happened.',
  },
  {
    title: 'Shared folder',
    body: 'One juststore folder in your Drive, so every machine sees the same files.',
  },
  {
    title: 'Machine to machine',
    body: 'Send a file to another machine by name. It waits in that machine’s inbox.',
  },
];

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

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">justdrive</span>
          <div className="flex items-center gap-5 text-sm">
            <a href="#commands" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Commands
            </a>
            <Link href="/login" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-20">
        <section className="mb-24 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Move files between your machines</h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-zinc-500 dark:text-zinc-400">
            Use your Google Drive as storage and justdrive as the courier. Sign in once on the web,
            then any VPS can pull a short-lived token.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Connect Google Drive
            </Link>
            <a
              href="#install"
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
            >
              Install
            </a>
          </div>
        </section>

        <section className="mb-24">
          <h2 className="mb-8 text-2xl font-semibold">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title}>
                <h3 className="mb-1.5 font-medium">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {feature.body}
                </p>
                {feature.code ? (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-sm text-zinc-100 dark:bg-zinc-950">
                    {feature.code}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id="install" className="mb-24">
          <h2 className="mb-6 text-2xl font-semibold">Install</h2>
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100 dark:bg-zinc-950">
            npm install -g justdrive
          </pre>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100 dark:bg-zinc-950">
            justdrive login
          </pre>
        </section>

        <section id="commands" className="mb-24">
          <h2 className="mb-6 text-2xl font-semibold">Commands</h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {commands.map((command) => (
              <li key={command.cmd} className="py-3">
                <p className="font-mono text-sm">{command.cmd}</p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{command.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-zinc-200 pt-8 text-sm text-zinc-400 dark:border-zinc-800">
          <Link href="/privacy">Privacy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </div>
  );
}
