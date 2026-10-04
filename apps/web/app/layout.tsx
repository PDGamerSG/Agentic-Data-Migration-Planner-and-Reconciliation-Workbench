import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Manifest · Migration Workbench",
  description:
    "Inspect, plan, approve, and reconcile a controlled data migration.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
