import { SiteFooter } from "#/components/shared/site-footer";
import { SiteHeader } from "#/components/shared/site-header";
import { InstallSection } from "./_components/install-section";
import { LandingHero } from "./_components/landing-hero";

export default function Home() {
  return (
    <div className="dark min-h-screen bg-neutral-950 text-neutral-100">
      <SiteHeader />
      <main>
        <LandingHero />
        {/* <section
          id="how-it-works"
          className="mx-auto max-w-5xl scroll-mt-24 px-4 py-20"
        >
          <h2 className="text-2xl font-semibold text-neutral-50">
            How it works
          </h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">
            One Drive connection, a handful of machines, and a CLI that moves
            files between them.
          </p>
          <div className="mt-12">
            <FeatureGrid />
          </div>
        </section> */}
        <div className="mx-auto max-w-5xl px-4 py-20">
          <InstallSection />
        </div>
        {/* <section
          id="commands"
          className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-24"
        >
          <h2 className="text-2xl font-semibold text-neutral-50">Commands</h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">
            Everything the CLI can do. Run any command with --help for the full
            options.
          </p>
          <div className="mt-8">
            <CommandList />
          </div>
        </section> */}
      </main>
      <SiteFooter />
    </div>
  );
}
