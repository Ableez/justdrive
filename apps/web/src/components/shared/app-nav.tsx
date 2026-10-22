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
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          justdrive
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        <span className="ml-auto hidden text-muted-foreground sm:inline">{email}</span>
        <form action="/logout" method="post">
          <button type="submit" className="text-muted-foreground transition-colors hover:text-foreground">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
