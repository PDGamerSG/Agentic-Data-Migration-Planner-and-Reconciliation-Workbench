import { config as loadEnv } from "dotenv";
loadEnv({ path: "../../.env", quiet: true });
import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: [
    "@manifest/core",
    "@manifest/fixtures",
    "@manifest/agent",
    "@manifest/db",
  ],
  poweredByHeader: false,
};
export default config;
