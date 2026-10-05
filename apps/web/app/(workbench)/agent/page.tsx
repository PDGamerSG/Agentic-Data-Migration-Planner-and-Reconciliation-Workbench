import type { Metadata } from "next";
import { Agent } from "./view";

export const metadata: Metadata = { title: "AI planner · Manifest" };

export default function AgentPage() {
  return <Agent />;
}
