"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Database,
  FlaskConical,
  GitBranch,
  History,
  LayoutGrid,
  Moon,
  Sparkles,
  Sun,
  Table2,
} from "lucide-react";
import type { Stage } from "./lifecycle";

export const navigation = [
  {
    id: "overview",
    href: "/",
    label: "Overview",
    short: "Overview",
    icon: LayoutGrid,
    stages: [],
  },
  {
    id: "schemas",
    href: "/schemas",
    label: "Schemas & source",
    short: "Source",
    icon: Table2,
    stages: ["staged"],
  },
  {
    id: "agent",
    href: "/agent",
    label: "Planning agent",
    short: "Agent",
    icon: Sparkles,
    stages: ["proposed", "decided"],
  },
  {
    id: "plans",
    href: "/plans",
    label: "Migration plans",
    short: "Plans",
    icon: GitBranch,
    stages: ["cleared"],
  },
  {
    id: "runs",
    href: "/runs",
    label: "Runs & quarantine",
    short: "Runs",
    icon: FlaskConical,
    stages: ["inspected"],
  },
  {
    id: "target",
    href: "/target",
    label: "Target & reconciliation",
    short: "Target",
    icon: Database,
    stages: ["landed", "reconciled"],
  },
  {
    id: "history",
    href: "/history",
    label: "Activity log",
    short: "Log",
    icon: History,
    stages: [],
  },
] as const;

/** The section's lifecycle state: attention outranks running, which outranks unfinished. */
function sectionState(ids: readonly string[], stages: Stage[]) {
  const own = stages.filter((s) => ids.includes(s.id));
  if (!own.length) return null;
  for (const s of ["attention", "running", "current", "waiting"] as const)
    if (own.some((o) => o.state === s)) return s;
  return "done";
}

export function Rail({
  view,
  stages,
  planCount,
}: {
  view: string;
  stages: Stage[] | null;
  planCount: number;
}) {
  return (
    <aside className="rail">
      <Link href="/" className="wordmark" aria-label="Manifest overview">
        <span className="wordmark-name">manifest</span>
        <span className="wordmark-form">Migration declaration</span>
      </Link>
      <nav aria-label="Main navigation" className="rail-nav">
        {navigation.map((n) => {
          const state = stages ? sectionState(n.stages, stages) : null;
          return (
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
              {n.id === "plans" && planCount > 0 && (
                <span className="rail-count">v{planCount}</span>
              )}
              {state && (
                <span className={`rail-state ${state}`} aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="rail-foot">
        <p>
          One source · one target
          <br />
          1,000 records maximum
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
