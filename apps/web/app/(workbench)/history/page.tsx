import type { Metadata } from "next";
import { History } from "./view";

export const metadata: Metadata = { title: "Activity log · Manifest" };

export default function HistoryPage() {
  return <History />;
}
