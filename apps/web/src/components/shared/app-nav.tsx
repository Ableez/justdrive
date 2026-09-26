import Link from 'next/link';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/devices', label: 'Devices' },
  { href: '/activity', label: 'Activity' },
  { href: '/transfers', label: 'Transfers' },
  { href: '/settings', label: 'Settings' },
];

export function AppNav({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <Link href="/dashboard" className="font-semibold">
          justdrive
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {link.label}
          </Link>
        ))}
        <span className="ml-auto hidden text-zinc-500 sm:inline">{email}</span>
        <form action="/logout" method="post">
          <button type="submit" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
