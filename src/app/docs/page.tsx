import type { Metadata } from "next";
import { DocsWorkspace } from "@/components/docs-workspace";
import { buildPageMetadata, pageSeo } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(pageSeo.docs);

export default function DocsPage() {
  return <DocsWorkspace />;
}
