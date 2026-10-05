import type { Metadata } from "next";
import { Schemas } from "./view";

export const metadata: Metadata = { title: "Schemas & source · Manifest" };

export default function SchemasPage() {
  return <Schemas />;
}
