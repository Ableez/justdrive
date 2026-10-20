export type DocSlug = "install" | "login" | "commands" | "transfers" | "devices";

export interface DocMeta {
  slug: DocSlug;
  title: string;
  navLabel: string;
  description: string;
}

export const DOCS: DocMeta[] = [
  {
    slug: "install",
    title: "Installation",
    navLabel: "Install",
    description: "Install justdrive with a single command.",
  },
  {
    slug: "login",
    title: "Sign in a machine",
    navLabel: "Login",
    description: "Sign a machine in with a device code.",
  },
  {
    slug: "commands",
    title: "Commands",
    navLabel: "Commands",
    description: "Every justdrive command and what it does.",
  },
  {
    slug: "transfers",
    title: "Transfers",
    navLabel: "Transfers",
    description: "Move files between your machines through Drive.",
  },
  {
    slug: "devices",
    title: "Devices",
    navLabel: "Devices",
    description: "List machines and revoke their access.",
  },
];

export function getDoc(slug: string): DocMeta | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

export function getNeighbors(slug: DocSlug): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const index = DOCS.findIndex((doc) => doc.slug === slug);
  return {
    prev: index > 0 ? DOCS[index - 1] : null,
    next: index < DOCS.length - 1 ? DOCS[index + 1] : null,
  };
}
