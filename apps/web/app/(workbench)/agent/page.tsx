import type { Metadata } from "next";
import { Agent } from "./view";

export const metadata: Metadata = { title: "Planning agent · Manifest" };

export default function AgentPage() {
  return <Agent />;
}
