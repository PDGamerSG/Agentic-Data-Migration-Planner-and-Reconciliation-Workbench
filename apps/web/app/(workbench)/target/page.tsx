import type { Metadata } from "next";
import { Target } from "./view";

export const metadata: Metadata = {
  title: "Load & verify · Manifest",
};

export default function TargetPage() {
  return <Target />;
}
