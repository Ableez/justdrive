import type { ReactNode } from 'react';

export function TerminalCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 min-h-32">
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-neutral-700" />
        <span className="size-2.5 rounded-full bg-neutral-800" />
        <span className="size-2.5 rounded-full bg-neutral-800" />
        <span className="ml-2 font-mono text-xs text-neutral-500">{title}</span>
      </div>
      <div className="p-4 font-mono text-sm leading-relaxed text-neutral-300">{children}</div>
    </div>
  );
}
