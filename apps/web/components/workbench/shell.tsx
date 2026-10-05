"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Database,
  FlaskConical,
  GitBranch,
  History,
  LayoutGrid,
  FolderOpen,
  Moon,
  Sparkles,
  Sun,
  Table2,
} from "lucide-react";

export const navigation = [
  {
    id: "overview",
    href: "/",
    label: "Overview",
    short: "Overview",
    icon: LayoutGrid,
  },
  {
    id: "tests",
    href: "/tests",
    label: "Test library",
    short: "Tests",
    icon: FolderOpen,
  },
  {
    id: "schemas",
    href: "/schemas",
    label: "Source data",
    short: "Source",
    icon: Table2,
  },
  {
    id: "agent",
    href: "/agent",
    label: "AI planner",
    short: "Planner",
    icon: Sparkles,
  },
  {
    id: "plans",
    href: "/plans",
    label: "Plan",
    short: "Plan",
    icon: GitBranch,
  },
  {
    id: "runs",
    href: "/runs",
    label: "Run results",
    short: "Results",
    icon: FlaskConical,
  },
  {
    id: "target",
    href: "/target",
    label: "Load & verify",
    short: "Load",
    icon: Database,
  },
  {
    id: "history",
    href: "/history",
    label: "Activity log",
    short: "Log",
    icon: History,
  },
] as const;

export function Rail({ view }: { view: string }) {
  return (
    <aside className="rail">
      <Link href="/" className="wordmark" aria-label="Manifest overview">
        <span className="wordmark-name">manifest</span>
        <span className="wordmark-form">Migration workbench</span>
      </Link>
      <nav aria-label="Main navigation" className="rail-nav">
        {navigation.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            aria-label={n.label}
            aria-current={view === n.id ? "page" : undefined}
            className={`rail-link ${view === n.id ? "active" : ""}`}
          >
            <n.icon size={17} aria-hidden="true" />
            <span className="rail-label">{n.label}</span>
            <span className="rail-short" aria-hidden="true">
              {n.short}
            </span>
          </Link>
        ))}
      </nav>
      <div className="rail-foot">
        <p>
          One source, one target
          <br />
          Up to 1,000 records
        </p>
      </div>
    </aside>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const stored = document.documentElement.dataset.theme as
      "light" | "dark" | undefined;
    setTheme(
      stored ??
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    );
  }, []);
  if (!theme)
    return <span className="icon-button placeholder" aria-hidden="true" />;
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        localStorage.setItem("manifest-theme", next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
