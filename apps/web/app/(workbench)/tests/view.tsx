"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useWorkbench } from "@/components/workbench/context";
import { openDecisions, type Plan } from "@/components/workbench/lifecycle";
import { Empty, Mark, Sheet, time } from "@/components/workbench/ui";

export function Tests() {
  const { state, actor } = useWorkbench();
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const groups = new Map<string, Plan[]>();
  const byId = new Map(state.plans.map((p) => [p.id, p]));
  for (const plan of state.plans) {
    let root = plan;
    const seen = new Set([root.id]);
    while (
      root.parentId &&
      byId.has(root.parentId) &&
      !seen.has(root.parentId)
    ) {
      root = byId.get(root.parentId)!;
      seen.add(root.id);
    }
    groups.set(root.id, [...(groups.get(root.id) ?? []), plan]);
  }
  const tests = [...groups.values()].map((versions) => {
    const ids = new Set(versions.map((p) => p.id));
    const runs = state.runs.filter((r) => ids.has(r.planVersionId));
    return {
      latest: versions[0]!,
      root: versions[versions.length - 1]!,
      versions,
      runs,
    };
  });
  const mine = (entry: (typeof tests)[number]) =>
    !!actor.trim() &&
    [
      ...entry.versions.map((p) => p.authorName),
      ...entry.runs.map((r) => r.startedBy),
    ].some((name) => name.trim().toLowerCase() === actor.trim().toLowerCase());
  const visible = tests.filter(
    (entry) =>
      (scope !== "mine" || mine(entry)) &&
      `${entry.root.authorName} ${entry.latest.proposal.summary} ${entry.versions.map((p) => `v${p.version} ${p.authorName}`).join(" ")} ${entry.runs.map((r) => r.startedBy).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="test-intro">
        <div>
          <span className="box-label">
            A test is a saved plan and its results
          </span>
          <p>
            Start fresh, answer the business questions, then preview which
            records can move. A dry run writes no data.
          </p>
        </div>
        <Link href="/schemas" className="text-link">
          View the demo dataset <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <Sheet
        title="Saved database tests"
        id="tests-heading"
        meta={
          <span>
            {tests.length} tests · {state.runs.length} runs
          </span>
        }
      >
        <div className="toolbar test-toolbar">
          <div className="test-scopes" role="group" aria-label="Test ownership">
            <button
              className={`code-filter ${scope === "all" ? "active" : ""}`}
              aria-label="All tests"
              aria-pressed={scope === "all"}
              onClick={() => setScope("all")}
            >
              All tests <b>{tests.length}</b>
            </button>
            <button
              className={`code-filter ${scope === "mine" ? "active" : ""}`}
              aria-label="My tests"
              aria-pressed={scope === "mine"}
              onClick={() => setScope("mine")}
            >
              My tests <b>{tests.filter(mine).length}</b>
            </button>
          </div>
          <label className="search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search tests"
              placeholder="Search by name, version or summary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {scope === "mine" && (
          <p className="library-note">
            {actor.trim()
              ? `Showing tests created, revised or run as ${actor.trim()}. Names label activity in this shared workbench.`
              : "Enter your name at the top to find tests you created or ran."}
          </p>
        )}
        {!visible.length ? (
          <Empty
            title={
              search
                ? "No matching tests"
                : scope === "mine"
                  ? "No tests under your name yet"
                  : "Start your first database test"
            }
            description={
              search
                ? "Try another name or version, or clear the search."
                : "Enter your name and choose New test at the top. Everyone's saved tests remain available here."
            }
          />
        ) : (
          <div className="test-list">
            {visible.map(({ latest, root, versions, runs }) => {
              const questions = openDecisions(latest);
              const dry = runs.find(
                (r) => r.planVersionId === latest.id && r.kind === "dry_run",
              );
              return (
                <article
                  className="test-entry"
                  key={root.id}
                  aria-label={`Test ${root.version} by ${root.authorName}`}
                >
                  <div className="test-entry-head">
                    <div>
                      <h3>Customer migration · test {root.version}</h3>
                      <p>
                        Started by <strong>{root.authorName}</strong> ·{" "}
                        {time(root.createdAt)}
                      </p>
                    </div>
                    <Mark
                      status={
                        latest.approval
                          ? "approved"
                          : questions
                            ? "draft"
                            : dry
                              ? dry.status
                              : "draft"
                      }
                      label={
                        latest.approval
                          ? "Approved"
                          : questions
                            ? `${questions} questions open`
                            : dry
                              ? dry.status === "succeeded"
                                ? "Dry run complete"
                                : `Dry run ${dry.status}`
                              : "Ready for dry run"
                      }
                    />
                  </div>
                  <p className="test-summary">{latest.proposal.summary}</p>
                  <div className="test-facts">
                    <span>
                      Latest version <b>{latest.version}</b> · by{" "}
                      {latest.authorName}
                    </span>
                    <span>
                      {dry ? (
                        <>
                          {dry.counts.accepted} accepted · {dry.counts.rejected}{" "}
                          held
                        </>
                      ) : (
                        "This version has no dry run yet"
                      )}
                    </span>
                  </div>
                  <div className="test-actions">
                    <Link
                      className="button secondary"
                      href={`/agent/${latest.id}`}
                    >
                      {questions ? "Answer questions" : "Review answers"}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                    <Link className="text-link" href={`/plans/${latest.id}`}>
                      Open plan
                    </Link>
                    {dry && (
                      <Link className="text-link" href={`/runs/${dry.id}`}>
                        View results
                      </Link>
                    )}
                  </div>
                  <details className="test-versions">
                    <summary>
                      {versions.length} saved{" "}
                      {versions.length === 1 ? "version" : "versions"} ·{" "}
                      {runs.length} {runs.length === 1 ? "run" : "runs"}
                    </summary>
                    <ul>
                      {versions.map((p) => (
                        <li key={p.id}>
                          <div>
                            <Link className="text-link" href={`/agent/${p.id}`}>
                              Questions for version {p.version}
                            </Link>
                            <small>
                              by {p.authorName} · {time(p.createdAt)}
                            </small>
                          </div>
                          <Link className="text-link" href={`/plans/${p.id}`}>
                            Plan v{p.version}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <ul>
                      {runs.map((r) => (
                        <li key={r.id}>
                          <div>
                            <Link className="text-link" href={`/runs/${r.id}`}>
                              {r.kind === "dry_run" ? "Dry run" : "Load"} · v
                              {byId.get(r.planVersionId)?.version} ·{" "}
                              {time(r.startedAt)}
                            </Link>
                            <small>
                              by {r.startedBy} · {r.counts.accepted} accepted ·{" "}
                              {r.counts.rejected} held
                            </small>
                          </div>
                          <Mark status={r.status} />
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
