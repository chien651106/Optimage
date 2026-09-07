import type { Metadata } from "next";

/** Global site identity — English for international SEO */
export const siteConfig = {
  name: "Pixora",
  tagline: "Image, Video & Document Tools",
  description:
    "Free online tools to resize, compress, and convert images, videos, and documents (PDF, Excel, HTML). Batch processing with ZIP download. No account required.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://pixora.app",
  locale: "en_US",
} as const;

export const pageSeo = {
  home: {
    title: "Image Resize, Compress & Convert",
    description:
      "Batch resize, compress, and convert images to JPEG, PNG, WebP, and more. Set max width or file size, then download as ZIP.",
    path: "/",
    keywords: [
      "image resize",
      "image compressor",
      "image converter",
      "batch image resize",
      "webp converter",
      "compress images online",
    ],
  },
  video: {
    title: "Video Convert, Compress & Resize",
    description:
      "Convert and compress videos to MP4, WebM, MOV, or GIF. Batch process and download as ZIP.",
    path: "/video",
    keywords: [
      "video converter",
      "video compressor",
      "mp4 converter",
      "webm converter",
      "gif converter",
      "compress video online",
    ],
  },
  docs: {
    title: "Document Converter — PDF, Excel, HTML",
    description:
      "Convert documents between PDF, Excel (XLSX), CSV, HTML, DOCX, TXT, and Markdown. Batch convert and download as ZIP.",
    path: "/docs",
    keywords: [
      "pdf converter",
      "excel converter",
      "csv to excel",
      "html to pdf",
      "docx to html",
      "document converter online",
    ],
  },
} as const;

export function buildPageMetadata(
  page: (typeof pageSeo)[keyof typeof pageSeo],
): Metadata {
  const url = new URL(page.path, siteConfig.url).toString();
  const fullTitle = `${page.title} | ${siteConfig.name}`;

  return {
    title: page.title,
    description: page.description,
    keywords: [...page.keywords],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      title: fullTitle,
      description: page.description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: page.description,
    },
  };
}
