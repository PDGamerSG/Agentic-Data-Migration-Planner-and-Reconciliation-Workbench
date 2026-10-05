import type { Metadata } from "next";
import { Runs } from "./view";

export const metadata: Metadata = { title: "Run results · Manifest" };

export default function RunsPage() {
  return <Runs />;
}
