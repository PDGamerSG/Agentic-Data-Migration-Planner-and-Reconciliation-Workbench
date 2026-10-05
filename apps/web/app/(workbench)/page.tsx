import type { Metadata } from "next";
import { Overview } from "./view";

export const metadata: Metadata = { title: "Overview · Manifest" };

export default function OverviewPage() {
  return <Overview />;
}
