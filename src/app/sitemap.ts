import type { MetadataRoute } from "next";
import { pageSeo, siteConfig } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = Object.values(pageSeo);

  return pages.map((page) => ({
    url: new URL(page.path, siteConfig.url).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: page.path === "/" ? 1 : 0.8,
  }));
}
