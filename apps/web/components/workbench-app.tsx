"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronDown, Loader2, Plus, X } from "lucide-react";
import type { RunView, WorkbenchState } from "@manifest/db";
import type { PlanSpec, RecordOutcome } from "@manifest/core";
import { WorkbenchContext, type Workbench } from "./workbench/context";
import {
  lifecycle,
  liveExecution,
  nextStage,
  openDecisions,
} from "./workbench/lifecycle";
import { Rail, ThemeToggle, navigation } from "./workbench/shell";
import { Empty, time } from "./workbench/ui";
import {
  ApproveDialog,
  EvidenceDialog,
  RollbackDialog,
} from "./workbench/dialogs";

const titles: Record<string, [string, string]> = {
  tests: [
    "Test library",
    "Start a database test, continue your questions, or explore the team's previous results.",
  ],
  overview: [
    "Migration overview",
    "Move old CRM customers into the new customer table, one step at a time.",
  ],
  schemas: [
    "Source data",
    "What the old data looks like and what the new table requires.",
  ],
  agent: ["AI planner", "The AI suggests a plan. You answer its questions."],
  plans: [
    "Plan",
    "Check the field mapping, test it with a dry run, then approve it.",
  ],
  runs: ["Run results", "Which records passed, and why the others were held."],
  target: [
    "Load & verify",
    "Load approved records, check the totals, or undo the load.",
  ],
  history: ["Activity log", "Every action, who did it and when."],
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "The operation failed.");
  return data as T;
}

export function WorkbenchApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  // Explicit pages supply their UI; the shared layout only needs the active section and ID.
  const view = pathname.split("/")[1] || "overview";
  const selectedId =
    typeof params.planId === "string"
      ? params.planId
      : typeof params.runId === "string"
        ? params.runId
        : undefined;
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [actor, setActor] = useState("");
  const [chosenPlan, setChosenPlan] = useState<string>();
  const [run, setRun] = useState<RunView | null>(null);
  const [runError, setRunError] = useState("");
  const [modal, setModal] = useState<
    "approve" | "rollback" | "evidence" | null
  >(null);
  const [evidence, setEvidence] = useState<RecordOutcome | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fault, setFault] = useState(false);
  const [pendingSession, setPendingSession] = useState<string>();
  const [pendingFresh, setPendingFresh] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api<WorkbenchState>("state");
      setState(next);
      setError("");
      return next;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the workbench.",
      );
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    setActor(localStorage.getItem("manifest-operator") ?? "");
  }, [refresh]);

  const runningSession = !!state?.sessions.some((s) => s.status === "running");
  useEffect(() => {
    if (!runningSession) return;
    const interval = setInterval(() => void refresh(), 1200);
    return () => clearInterval(interval);
  }, [runningSession, refresh]);

  const focusedId =
    view === "target"
      ? chosenPlan
      : view === "runs" && selectedId
        ? state?.runs.find((r) => r.id === selectedId)?.planVersionId
        : selectedId;
  const plan =
    pendingFresh && view === "agent" && !selectedId
      ? undefined
      : focusedId
        ? state?.plans.find((p) => p.id === focusedId)
        : ((view === "target"
            ? state?.plans.find((p) => p.approval)
            : undefined) ?? state?.plans[0]);

  useEffect(() => {
    if (!pendingSession || !state) return;
    const created = state.plans.find(
      (p) => p.agentSessionId === pendingSession,
    );
    const session = state.sessions.find((s) => s.id === pendingSession);
    if (created) {
      setPendingSession(undefined);
      setPendingFresh(false);
      router.push(`/agent/${created.id}`);
      setNotice(
        `Plan version ${created.version} is ready. Review its questions before a dry run.`,
      );
    } else if (session?.status === "failed") {
      setPendingSession(undefined);
      setPendingFresh(false);
      setError(session.error || "The planner failed. Start the test again.");
    }
  }, [pendingSession, state, router]);

  const runId =
    view === "runs" && selectedId
      ? selectedId
      : view === "overview"
        ? state?.runs.find(
            (r) =>
              r.planVersionId === plan?.id &&
              r.kind === "dry_run" &&
              r.status === "succeeded",
          )?.id
        : (state?.runs.find(
            (r) => r.planVersionId === plan?.id && r.kind === "dry_run",
          )?.id ?? state?.runs[0]?.id);

  useEffect(() => {
    setRunError("");
    if (!runId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    void api<RunView>(`runs/${runId}`)
      .then((v) => {
        if (!cancelled) setRun(v);
      })
      .catch((e) => {
        if (!cancelled) {
          setRunError(String(e.message));
          setError(String(e.message));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runId, state?.runs.length]);

  // Immutable versions make the id a complete dependency.
  useEffect(() => {
    if (plan) setAnswers(plan.answers);
  }, [plan?.id]);

  useEffect(() => {
    setModal(null);
  }, [view, selectedId]);

  const act = async <T,>(
    label: string,
    path: string,
    body: unknown,
    done?: (result: T) => void,
  ) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const result = await api<T>(path, body);
      await refresh();
      done?.(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy("");
    }
  };

  const startPlanner = (fresh: boolean) => {
    if (busy || runningSession || !actor.trim()) return;
    void act<{ id: string }>(
      "Starting AI planner",
      "agent",
      {
        startedBy: actor,
        answers: fresh
          ? {}
          : Object.fromEntries(
              Object.entries(answers).filter(([, value]) => value),
            ),
        ...(!fresh && plan ? { basePlanId: plan.id } : {}),
      },
      (session) => {
        setPendingSession(session.id);
        setPendingFresh(fresh);
        setNotice(
          fresh
            ? "New test started. The planner will prepare fresh questions for this dataset."
            : "Updating your selected plan with these answers.",
        );
        if (fresh) router.push("/agent");
      },
    );
  };

  const stages = useMemo(() => (state ? lifecycle(state) : null), [state]);
  const landedKeys = useMemo(
    () =>
      new Set(
        (state?.target ?? [])
          .filter((r) => r._migration_lineage_id !== null)
          .map((r) => String(r.legacy_id)),
      ),
    [state?.target],
  );

  let wb: Workbench | null = null;
  if (state && stages) {
    const execution = liveExecution(state);
    const reconciliation = state.reconciliations.find(
      (r) =>
        r.lineageId ===
        (execution?.lineageId ??
          state.runs.find((x) => x.kind === "execution")?.lineageId),
    );
    const dryForApproval = state.runs.find(
      (r) =>
        r.kind === "dry_run" &&
        r.planVersionId === plan?.id &&
        r.status === "succeeded",
    );
    const openQuestions = openDecisions(plan);
    const executeWith = (planId: string, retry: boolean) =>
      void act<{ run: RunView; noop: boolean }>(
        retry ? "Retrying migration" : "Executing migration",
        "execute",
        {
          planId,
          startedBy: actor,
          ...(!retry && fault ? { failAfterBatch: 3 } : {}),
        },
        (r) => {
          setRun(r.run);
          router.push(`/runs/${r.run.id}`);
          setNotice(
            r.noop
              ? "Already loaded. This retry made no changes."
              : r.run.status === "failed"
                ? "Load stopped part way. Retry is safe: loaded rows are skipped."
                : retry
                  ? `Retry complete: ${r.run.insertedCount} inserted, ${r.run.skippedExisting} already loaded.`
                  : "Records loaded. Check the totals next.",
          );
        },
      );
    wb = {
      state,
      view,
      plan,
      run,
      runError,
      actor,
      busy,
      runningSession,
      stages,
      execution,
      reconciliation,
      dryForApproval,
      openQuestions,
      canApprove: !!dryForApproval && !plan?.approval && openQuestions === 0,
      landedKeys,
      answers,
      setAnswers,
      fault,
      setFault,
      choosePlan: setChosenPlan,
      navigate: (href) => router.push(href),
      fail: setError,
      draft: () => startPlanner(false),
      startTest: () => startPlanner(true),
      dry: () =>
        plan &&
        void act<RunView>(
          "Running dry run",
          "dry-run",
          { planId: plan.id, startedBy: actor },
          (r) => {
            setRun(r);
            router.push(`/runs/${r.id}`);
            setNotice("Dry run finished. No data was written.");
          },
        ),
      execute: () =>
        plan && executeWith(plan.id, execution?.status === "failed"),
      retry: (planId) => executeWith(planId, true),
      reconcile: () =>
        execution &&
        void act(
          "Checking totals",
          "reconcile",
          { lineageId: execution.lineageId, actor },
          () => setNotice("Totals checked."),
        ),
      savePlan: (spec: PlanSpec, summary: string) =>
        plan &&
        void act<{ id: string }>(
          "Saving plan version",
          "plans",
          {
            parentId: plan.id,
            spec,
            authorName: actor,
            changeSummary: summary,
          },
          (p) => {
            router.push(`/plans/${p.id}`);
            setNotice(
              "Saved as a new version. Run a dry run, then approve it.",
            );
          },
        ),
      openApprove: () => setModal("approve"),
      openRollback: () => setModal("rollback"),
      openEvidence: (o) => {
        setEvidence(o);
        setModal("evidence");
      },
    };
  }

  const [title, subtitle] = titles[view]!;
  const section = navigation.find((n) => n.id === view)!;

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Rail view={view} />
      <div className="desk">
        <header className="topbar">
          <p className="topbar-path">
            <span>{section.label}</span>
          </p>
          <label className="operator">
            <span>Your name</span>
            <input
              aria-label="Operator name"
              value={actor}
              placeholder="Needed to run or approve"
              onChange={(e) => {
                setActor(e.target.value);
                localStorage.setItem("manifest-operator", e.target.value);
              }}
              maxLength={100}
            />
          </label>
          {wb && (
            <details className="operator-history" key={actor}>
              <summary>
                Your runs{" "}
                <span className="mono">
                  {
                    state!.runs.filter(
                      (r) =>
                        r.startedBy.trim().toLowerCase() ===
                        actor.trim().toLowerCase(),
                    ).length
                  }
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="operator-menu">
                <strong>
                  {actor.trim()
                    ? `Recent runs by ${actor.trim()}`
                    : "Your previous runs"}
                </strong>
                {state!.runs
                  .filter(
                    (r) =>
                      actor.trim() &&
                      r.startedBy.trim().toLowerCase() ===
                        actor.trim().toLowerCase(),
                  )
                  .slice(0, 3)
                  .map((r) => (
                    <Link
                      key={r.id}
                      href={`/runs/${r.id}`}
                      onClick={(e) =>
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      <span>
                        {r.kind === "dry_run" ? "Dry run" : "Load"} · v
                        {
                          state!.plans.find((p) => p.id === r.planVersionId)
                            ?.version
                        }
                      </span>
                      <small>
                        {time(r.startedAt)} · {r.counts.accepted} accepted ·{" "}
                        {r.counts.rejected} held
                      </small>
                    </Link>
                  ))}
                {!state!.runs.some(
                  (r) =>
                    actor.trim() &&
                    r.startedBy.trim().toLowerCase() ===
                      actor.trim().toLowerCase(),
                ) && (
                  <p>
                    {actor.trim()
                      ? "No runs under this name yet. Start a test and run a dry run to see it here."
                      : "Enter the name you used on earlier runs to find them."}
                  </p>
                )}
                <Link
                  className="text-link"
                  href="/tests"
                  onClick={(e) =>
                    e.currentTarget.closest("details")?.removeAttribute("open")
                  }
                >
                  Browse test library{" "}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </details>
          )}
          {wb && (
            <button
              className="button secondary new-test"
              onClick={wb.startTest}
              disabled={!!busy || runningSession || !actor.trim()}
              title={
                !actor.trim()
                  ? "Enter your name to start a test"
                  : "Start with fresh answers on the demo dataset"
              }
            >
              <Plus size={15} aria-hidden="true" />
              New test
            </button>
          )}
          <span
            className="environment"
            title="Data is written to a demo table in PostgreSQL"
          >
            <span className="environment-dot" aria-hidden="true" />
            Demo database
          </span>
          <ThemeToggle />
        </header>
        <main id="main" className="page">
          <div className="title-band">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {wb && <TitleActions wb={wb} />}
          </div>
          <div className="signals" aria-live="polite">
            {error && (
              <div className="signal error" role="alert">
                <span>{error}</span>
                <button
                  className="icon-button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {notice && (
              <div className="signal notice" role="status">
                <span>{notice}</span>
                <button
                  className="icon-button"
                  onClick={() => setNotice("")}
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {busy && (
              <div className="signal working" role="status">
                <Loader2 className="spin" size={16} aria-hidden="true" />
                {busy}…
              </div>
            )}
            {wb &&
              !actor.trim() &&
              view !== "overview" &&
              view !== "history" &&
              view !== "schemas" && (
                <div className="signal hint">
                  <span>
                    Enter your name at the top to run, approve or load.
                  </span>
                </div>
              )}
          </div>
          {!wb ? (
            <div className="sheet">
              {error ? (
                <Empty
                  title="Connect the database"
                  description="Set the Neon connection string, apply the migrations and seed the bounded dataset. The source stays in PostgreSQL."
                >
                  <code className="setup-command">
                    pnpm db:deploy && pnpm db:seed
                  </code>
                  <button
                    className="button secondary"
                    onClick={() => void refresh()}
                  >
                    Retry connection
                  </button>
                </Empty>
              ) : (
                <div className="loading-sheet" role="status">
                  <Loader2 className="spin" size={18} aria-hidden="true" />
                  Loading…
                </div>
              )}
            </div>
          ) : (
            <WorkbenchContext.Provider value={wb}>
              {children}
              {modal === "approve" && (
                <ApproveDialog
                  onClose={() => setModal(null)}
                  onDone={setNotice}
                  act={act}
                />
              )}
              {modal === "rollback" && (
                <RollbackDialog
                  onClose={() => setModal(null)}
                  onDone={setNotice}
                  act={act}
                />
              )}
              {modal === "evidence" && evidence && run && (
                <EvidenceDialog
                  outcome={evidence}
                  run={run}
                  onClose={() => setModal(null)}
                />
              )}
            </WorkbenchContext.Provider>
          )}
          <footer className="colophon">
            <span>Manifest · migration workbench</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function TitleActions({ wb }: { wb: Workbench }) {
  const next = nextStage(wb.stages);
  const proposing = next?.id === "proposed";
  const draftButton = (
    <button
      className="button primary"
      onClick={wb.draft}
      disabled={!!wb.busy || wb.runningSession || !wb.actor.trim()}
    >
      {wb.runningSession ? "AI planner running…" : "Create plan with AI"}
    </button>
  );
  // One next step per page: the overview points at the first unfinished stage.
  if (wb.view === "overview")
    return next ? (
      <div className="title-actions">
        {proposing ? (
          draftButton
        ) : (
          <Link href={next.href} className="button primary">
            {next.action}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    ) : null;
  if (wb.view === "agent" && !wb.plan)
    return <div className="title-actions">{draftButton}</div>;
  if (wb.view === "plans" && wb.plan)
    return (
      <div className="title-actions">
        <button
          className="button primary"
          disabled={!wb.plan || !!wb.busy || !wb.actor.trim()}
          onClick={wb.dry}
        >
          Run dry run
        </button>
      </div>
    );
  return null;
}

export type Act = <T>(
  label: string,
  path: string,
  body: unknown,
  done?: (result: T) => void,
) => Promise<T | undefined>;
