import type { Metadata } from "next";
import { Plans } from "./view";

export const metadata: Metadata = { title: "Plan · Manifest" };

export default function PlansPage() {
  return <Plans />;
}
