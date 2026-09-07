import type { Metadata } from "next";
import { VideoWorkspace } from "@/components/video-workspace";
import { buildPageMetadata, pageSeo } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(pageSeo.video);

export default function VideoPage() {
  return <VideoWorkspace />;
}
