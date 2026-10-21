import type { ReactNode } from 'react';

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-xs text-neutral-200">
      {children}
    </code>
  );
}
