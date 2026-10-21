import { baseUrl } from '#/lib/env';
import { cn } from '#/lib/utils';

export function InstallCommand({ className }: { className?: string }) {
  return (
    <code className={cn('font-mono text-xs text-neutral-100 t', className)}>
      {`curl -fsSL ${baseUrl()}/install.sh | sh`}
    </code>
  );
}
