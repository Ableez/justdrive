import Link from "next/link";
import { GoogleGIcon } from "./google-g-icon";
import { JustdriveLogo } from "./justdrive-logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-neutral-50">
          <JustdriveLogo className="h-6 w-auto" variant="white" />
          Justdrive
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/docs"
            className="text-neutral-400 hover:text-neutral-100 font-semibold"
          >
            Docs
          </Link>
          <Link
            href="/docs/commands"
            className="hidden text-neutral-400 hover:text-neutral-100 sm:inline"
          >
            Commands
          </Link>
          <Link href={"/auth/google?next=%2Fdashboard"}>
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl cursor-pointer hover:scale-[0.98] hover:bg-white/80 font-semibold duration-300 ease-in-out transition-all">
              <GoogleGIcon className="size-4" />
              Sign in
            </button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
