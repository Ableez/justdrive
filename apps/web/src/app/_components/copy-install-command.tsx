"use client";

import { toast } from "sonner";

export function CopyInstallCommand({ command }: { command: string }) {
  return (
    <button
      type="button"
      title="Copy to clipboard"
      onClick={() => {
        navigator.clipboard.writeText(command);
        toast.success("Copied to clipboard");
      }}
      className="w-fit select-all rounded-xl border-2 border-neutral-800 bg-neutral-900 px-5 py-3 text-left font-mono text-base text-neutral-100 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-600 active:scale-[.99]"
    >
      {`$ ${command}`}
    </button>
  );
}
