const frames = [
  ['┌──────────────┐', '│  > _         │', '│  ▔▔▔▔▔▔▔▔  │', '└──────────────┘'],
  ['┌──────────────┐', '│  >           │', '│  ▔▔▔▔▔▔▔▔  │', '└──────────────┘'],
];

export function logoFrame(index: number): string {
  const frame = frames[index % frames.length];
  return frame.join('\n');
}

export async function playLogoAnimation(durationMs = 800): Promise<void> {
  if (!process.stdout.isTTY) return;
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < durationMs) {
    process.stdout.write('\r\x1b[2K');
    process.stdout.write(logoFrame(i).replace(/\n/g, '\r\n'));
    i += 1;
    await new Promise((resolve) => setTimeout(resolve, 160));
  }
  process.stdout.write('\r\x1b[2K');
  process.stdout.write('\x1b[4A\x1b[J');
}