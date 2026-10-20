import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsCommands } from "../_components/docs-commands";
import { DocsDevices } from "../_components/docs-devices";
import { DocsInstall } from "../_components/docs-install";
import { DocsLogin } from "../_components/docs-login";
import { DocsTransfers } from "../_components/docs-transfers";
import { DOCS, getDoc, getNeighbors } from "../_components/docs-meta";
import { DocsShell } from "../_components/docs-shell";

export function generateStaticParams() {
  return DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return { title: "Not found" };
  return {
    title: `${doc.title} — justdrive docs`,
    description: doc.description,
  };
}

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const { prev, next } = getNeighbors(doc.slug);

  return (
    <DocsShell title={doc.title} prev={prev} next={next}>
      {doc.slug === "install" && <DocsInstall />}
      {doc.slug === "login" && <DocsLogin />}
      {doc.slug === "commands" && <DocsCommands />}
      {doc.slug === "transfers" && <DocsTransfers />}
      {doc.slug === "devices" && <DocsDevices />}
    </DocsShell>
  );
}
