"use client";
import { ImagesBadge } from "#/components/ui/images-badge";
import { HeroVisuals } from "./hero-visuals";
// Import toast from sonner (assuming you use sonner's react api)
import { toast } from "sonner";

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-neutral-900 bg-neutral-950 h-screen">
      <HeroVisuals />
      <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-24 text-center sm:pb-28 sm:pt-32 z-10 items-center justify-between flex flex-col">
        <div className="flex justify-center">
          <ImagesBadge
            text="justdrive"
            images={[
              "/glyphs/terminal.svg",
              "/glyphs/file.svg",
              "/glyphs/drive.svg",
            ]}
            folderSize={{ width: 36, height: 27 }}
            teaserImageSize={{ width: 22, height: 16 }}
            hoverImageSize={{ width: 52, height: 36 }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="mx-auto mt-8 max-w-4xl text-6xl font-medium tracking-tight text-neutral-50 sm:text-8xl">
            Move files between your machines
          </h1>
          <p className="mx-auto mt-5 md:max-w-md max-w-sm text-base text-neutral-400 sm:text-lg">
            Save files from your command line to Google Drive and transfer them
            between your machines
          </p>
        </div>

        <div className="mt-16 flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            className="bg-neutral-900 text-neutral-100 rounded-2xl px-5 py-3 text-left text-base font-mono select-all shadow-sm border-2 border-neutral-800 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-neutral-600 active:scale-[.99] w-fit"
            style={{ fontFamily: "inherit" }}
            onClick={() => {
              navigator.clipboard.writeText(
                "$ curl -fsSL http://localhost:3000/install.sh | sh",
              );
              toast.success("Copied to clipboard!");
            }}
            title="Copy to clipboard"
          >
            $ curl -fsSL http://localhost:3000/install.sh | sh
          </button>
          <p className=" text-sm text-neutral-500">
            Install and signin with your Google account
          </p>
        </div>
      </div>
    </section>
  );
}
