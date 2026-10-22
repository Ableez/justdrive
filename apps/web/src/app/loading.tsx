export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10" aria-busy="true">
      <p className="animate-pulse text-sm text-muted-foreground">Loading…</p>
    </main>
  );
}
