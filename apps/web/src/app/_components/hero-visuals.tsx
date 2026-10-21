"use client";

import { BackgroundRippleEffect } from "#/components/ui/background-ripple-effect";
import { ParallaxHeroImages } from "#/components/ui/parallax-hero-images";
import { Spotlight } from "#/components/ui/spotlight-new";

const glyphs = [
  "/glyphs/terminal.svg",
  "/glyphs/file.svg",
  "/glyphs/drive.svg",
  "/glyphs/inbox.svg",
];

export function HeroVisuals() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden min-h-screen"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_65%)]" />
      <BackgroundRippleEffect />
      <ParallaxHeroImages
        images={glyphs}
        className="z-10 hidden md:block"
        imageClassName="h-14 w-14 rounded-xl object-contain ring-1 ring-white/10 sm:h-16 sm:w-16 md:h-20 md:w-20"
      />
      <Spotlight />
    </div>
  );
}
