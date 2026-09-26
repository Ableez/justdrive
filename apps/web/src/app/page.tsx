const sections = [
  { id: "features", label: "Features" },
  { id: "install", label: "Install" },
  { id: "quickstart", label: "Quick Start" },
  { id: "commands", label: "Commands" },
  { id: "dashboard", label: "Dashboard" },
];

const Code = ({ children }: { children: string }) => (
  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
    {children}
  </code>
);

const Pre = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100 dark:bg-zinc-950">
    {children}
  </pre>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <a href="#" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            justdrive
          </a>
          <div className="hidden gap-6 sm:flex">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                {s.label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-20">
        {/* Hero */}
        <section className="mb-32 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Google Drive from the CLI
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-zinc-500 dark:text-zinc-400">
            Upload, download, browse, share, and organize files on Google Drive
            without leaving your terminal. Ships with a web dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href="#install"
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get Started
            </a>
            <a
              href="#commands"
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Commands
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-32">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Features
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { title: "Full Drive Access", body: "Browse, upload, download, move, rename, and delete any file on your Google Drive." },
              { title: "Path-Based Navigation", body: "Use familiar paths like photos/2024/vacation.jpg. Resolution walks the tree segment by segment." },
              { title: "OAuth2 Auth Flow", body: "One command to authenticate. Refresh tokens are stored locally and auto-renewed." },
              { title: "Progress & Formatting", body: "Spinners, table output, JSON mode, and colorized status for a polished CLI experience." },
              { title: "Embedded Dashboard", body: "justdrive dashboard starts a local web UI with file browser, upload form, activity log, and auth status." },
              { title: "Activity Logging", body: "Every operation is logged to ~/.justdrive/activity.json. Review what you've done." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                <h3 className="mb-1.5 font-medium text-zinc-900 dark:text-zinc-50">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Install */}
        <section id="install" className="mb-32">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Install
          </h2>
          <p className="mb-4 text-zinc-500 dark:text-zinc-400">
            Install globally via npm:
          </p>
          <Pre>{`npm install -g @justdrive`}</Pre>
          <p className="mt-4 text-zinc-500 dark:text-zinc-400">
            Or run directly without installing:
          </p>
          <Pre>{`npx @justdrive --help`}</Pre>
        </section>

        {/* Quick Start */}
        <section id="quickstart" className="mb-32">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Quick Start
          </h2>
          <div className="space-y-4">
            {[
              { step: "1", title: "Authenticate", code: "justdrive auth login" },
              { step: "2", title: "List your Drive root", code: "justdrive files ls" },
              { step: "3", title: "Upload a file", code: "justdrive files upload ./resume.pdf" },
              { step: "4", title: "Download a file", code: "justdrive files download photos/vacation.jpg" },
              { step: "5", title: "Start the dashboard", code: "justdrive dashboard" },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {s.step}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">{s.title}</p>
                  <Pre>{s.code}</Pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Commands */}
        <section id="commands" className="mb-32">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Commands
          </h2>
          <div className="space-y-10">
            {[
              {
                group: "justdrive auth",
                desc: "Authentication commands",
                items: [
                  { cmd: "justdrive auth login", desc: "Authenticate with Google Drive via OAuth2. Opens a browser for consent." },
                  { cmd: "justdrive auth logout", desc: "Revoke stored credentials and delete the token file." },
                ],
              },
              {
                group: "justdrive files",
                desc: "File operations",
                items: [
                  { cmd: "justdrive files ls [path]", desc: "List files in a directory. Supports --json for machine-readable output." },
                  { cmd: "justdrive files upload <local> [drive-path]", desc: "Upload a file to Drive. Optionally specify a destination directory." },
                  { cmd: "justdrive files download <drive-path> [local]", desc: "Download a file from Drive to local disk." },
                  { cmd: "justdrive files mkdir <path>", desc: "Create a directory on Drive." },
                  { cmd: "justdrive files mv <source> <dest>", desc: "Move or rename a file or folder." },
                  { cmd: "justdrive files rm <path>", desc: "Remove a file (moves to Drive trash)." },
                ],
              },
              {
                group: "justdrive share",
                desc: "Sharing",
                items: [
                  { cmd: "justdrive share <path> [--email] [--role]", desc: "Share a file. Default role is reader. Omit email for a link-only share." },
                ],
              },
              {
                group: "justdrive status",
                desc: "Status",
                items: [
                  { cmd: "justdrive status", desc: "Show authentication status, user email, and token expiry." },
                ],
              },
              {
                group: "justdrive dashboard",
                desc: "Web dashboard",
                items: [
                  { cmd: "justdrive dashboard [-p, --port]", desc: "Start the companion web dashboard on port 4000 (or next available)." },
                ],
              },
            ].map((group) => (
              <div key={group.group}>
                <h3 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">{group.group}</h3>
                <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">{group.desc}</p>
                <div className="space-y-3">
                  {group.items.map((c) => (
                    <div key={c.cmd} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                      <p className="mb-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">{c.cmd}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dashboard */}
        <section id="dashboard" className="mb-32">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h2>
          <p className="mb-4 text-zinc-500 dark:text-zinc-400">
            The embedded web dashboard provides a visual interface for browsing files,
            uploading, viewing activity, and managing authentication. Start it with:
          </p>
          <Pre>{`justdrive dashboard --port 4000`}</Pre>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            The dashboard includes a file browser with folder navigation, an upload form,
            an activity log, and an auth status panel. Runs entirely on your local machine.
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-200 pt-8 text-center text-sm text-zinc-400 dark:border-zinc-800">
          <p className="mb-2">
            <a href="https://github.com/Ableez/justdrive" className="hover:text-zinc-600 dark:hover:text-zinc-300">
              GitHub
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
