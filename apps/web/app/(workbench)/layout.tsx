import { WorkbenchApp } from "@/components/workbench-app";

// Every page below shares the sidebar, data, operator name and migration actions.
export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkbenchApp>{children}</WorkbenchApp>;
}
