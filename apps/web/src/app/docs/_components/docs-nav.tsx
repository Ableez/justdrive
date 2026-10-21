"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS } from "./docs-meta";

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Documentation"
      className="lg:sticky lg:top-20 lg:h-fit lg:w-44 lg:shrink-0"
    >
      <p className="text-sm font-medium text-neutral-100">justdrive docs</p>
      <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        {DOCS.map((doc) => {
          const href = `/docs/${doc.slug}`;
          const isActive = pathname === href;
          return (
            <li key={doc.slug}>
              <Link
                href={href}
                className={`block rounded-md border px-3 py-1.5 text-sm transition-colors
                  ${
                    isActive
                      ? "border-blue-500 text-blue-400 bg-neutral-900"
                      : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-100"
                  }
                  lg:border-transparent lg:px-2 lg:hover:bg-neutral-900`}
                aria-current={isActive ? "page" : undefined}
              >
                {doc.navLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
