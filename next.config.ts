import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone chỉ cần khi Docker/self-host; Vercel dùng output mặc định
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
