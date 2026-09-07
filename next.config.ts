import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone chỉ cần khi Docker/self-host; Vercel dùng output mặc định
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  serverExternalPackages: [
    "fluent-ffmpeg",
    "ffmpeg-static",
    "pdfkit",
    "pdf-parse",
    "mammoth",
    "xlsx",
  ],
  experimental: {
    // Video uploads up to 500MB; docs ≤50MB
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
