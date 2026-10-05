import type { Metadata } from "next";
import { Runs } from "./view";

export const metadata: Metadata = { title: "Runs & quarantine · Manifest" };

export default function RunsPage() {
  return <Runs />;
}
