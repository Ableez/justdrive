import type { ReactNode } from "react";
import { SiteFooter } from "#/components/shared/site-footer";
import { SiteHeader } from "#/components/shared/site-header";
import { DocsHeader } from "./docs-header";
import { DocsNav } from "./docs-nav";
import { DocsPager } from "./docs-pager";
import type { DocMeta } from "./docs-meta";

export function DocsShell({
  title,
  prev,
  next,
  children,
}: {
  title: string;
  prev: DocMeta | null;
  next: DocMeta | null;
  children: ReactNode;
}) {
  return (
    <div className="dark flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-8 py-12 lg:flex-row lg:gap-16">
        <DocsNav />
        <main className="min-w-0 flex-1 space-y-10">
          <DocsHeader title={title} prev={prev} next={next} />
          <article
            id="docs-content"
            className="space-y-4 text-sm leading-relaxed text-neutral-400"
          >
            {children}
          </article>
          <DocsPager prev={prev} next={next} />
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
