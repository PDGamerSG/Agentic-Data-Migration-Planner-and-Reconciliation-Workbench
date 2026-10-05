import type { Metadata } from "next";
import { Tests } from "./view";

export const metadata: Metadata = { title: "Test library · Manifest" };
export default function TestsPage() {
  return <Tests />;
}
