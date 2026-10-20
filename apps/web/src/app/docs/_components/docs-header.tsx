"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DocMeta } from "./docs-meta";

function pageText(): string {
  const el = document.getElementById("docs-content");
  return el?.innerText.trim() ?? "";
}

export function DocsHeader({
  title,
  prev,
  next,
}: {
  title: string;
  prev: DocMeta | null;
  next: DocMeta | null;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const copyPage = useCallback(async () => {
    const text = pageText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const downloadPage = useCallback(() => {
    const text = `# ${title}\n\n${pageText()}\n`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [title]);

  const arrowClass = (enabled: boolean) =>
    `flex size-11 items-center justify-center rounded-xl transition-colors ${
      enabled
        ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
        : "cursor-not-allowed bg-neutral-900 text-neutral-600"
    }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-50">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <div ref={menuRef} className="relative">
          <div className="flex overflow-hidden rounded-xl bg-neutral-800">
            <button
              type="button"
              onClick={copyPage}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13.3 4.3 6.5 11.1 2.7 7.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
              {copied ? "Copied" : "Copy Page"}
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Copy options"
              className="border-l border-neutral-700/60 px-3 text-neutral-100 transition-colors hover:bg-neutral-700"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="m3.5 5.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {open && (
            <div className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  void copyPage();
                  setOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              >
                Copy as plain text
              </button>
              <button
                type="button"
                onClick={downloadPage}
                className="block w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              >
                Download as .txt
              </button>
            </div>
          )}
        </div>
        {prev ? (
          <Link href={`/docs/${prev.slug}`} aria-label={`Previous: ${prev.title}`} className={arrowClass(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <span aria-hidden="true" className={arrowClass(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {next ? (
          <Link href={`/docs/${next.slug}`} aria-label={`Next: ${next.title}`} className={arrowClass(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <span aria-hidden="true" className={arrowClass(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
