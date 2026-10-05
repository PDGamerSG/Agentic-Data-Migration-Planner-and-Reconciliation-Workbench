import type { Metadata } from "next";
import { Target } from "./view";

export const metadata: Metadata = {
  title: "Target & reconciliation · Manifest",
};

export default function TargetPage() {
  return <Target />;
}
