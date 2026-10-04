import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: "../../.env", quiet: true });
import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@manifest/core",
    "@manifest/fixtures",
    "@manifest/agent",
    "@manifest/db",
  ],
  poweredByHeader: false,
};
export default config;
