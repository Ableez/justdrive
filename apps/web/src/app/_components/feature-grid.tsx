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

export function FeatureGrid() {
  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <div key={feature.title}>
          <h3 className="text-sm font-medium text-neutral-100">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{feature.body}</p>
          {feature.code ? (
            <code className="mt-3 inline-block rounded-md bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-300">
              {feature.code}
            </code>
          ) : null}
        </div>
      ))}
    </div>
  );
}
