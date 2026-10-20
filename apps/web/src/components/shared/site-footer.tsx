import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-900 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm text-neutral-500 sm:flex-row">
        <p>Justdrive</p>
        <nav className="flex items-center gap-6">
          <a
            target="_blank"
            href="https://astexlabs.com"
            className="hover:text-neutral-200 flex items-center justify-start gap-1"
          >
            <Image
              src={"https://www.astexlabs.com/logo.png"}
              width={32}
              height={32}
              alt="AX"
            />
            <span className="font-semibold text-white">Astexlabs</span>
          </a>
          <Link href="/docs" className="hover:text-neutral-200">
            Docs
          </Link>
          <Link href="/privacy" className="hover:text-neutral-200">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-neutral-200">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
