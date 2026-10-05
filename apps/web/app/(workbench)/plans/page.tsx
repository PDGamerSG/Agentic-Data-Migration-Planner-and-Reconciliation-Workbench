import type { Metadata } from "next";
import { Plans } from "./view";

export const metadata: Metadata = { title: "Migration plans · Manifest" };

export default function PlansPage() {
  return <Plans />;
}
