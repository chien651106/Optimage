import type { Metadata } from "next";
import { ImageWorkspace } from "@/components/image-workspace";
import { buildPageMetadata, pageSeo } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(pageSeo.home);

export default function HomePage() {
  return <ImageWorkspace />;
}
