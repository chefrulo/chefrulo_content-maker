import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
