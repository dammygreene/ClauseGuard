import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js (via unpdf) and mammoth are Node-side parsers; keep them out of the bundle.
  serverExternalPackages: ["unpdf", "mammoth"],
  // Allow the sandbox preview proxy to load dev assets.
  allowedDevOrigins: ["*.e2b.app", "**.e2b.app"],
};

export default nextConfig;
