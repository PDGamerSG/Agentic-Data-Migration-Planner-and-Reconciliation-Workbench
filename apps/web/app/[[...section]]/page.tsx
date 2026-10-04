import { notFound } from "next/navigation";
import { WorkbenchApp } from "@/components/workbench-app";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const view = section[0] ?? "overview";
  if (
    ![
      "overview",
      "schemas",
      "agent",
      "plans",
      "runs",
      "target",
      "history",
    ].includes(view) ||
    section.length > 2 ||
    (section.length === 2 && !["plans", "runs"].includes(view))
  )
    notFound();
  return <WorkbenchApp view={view} selectedId={section[1]} />;
}
