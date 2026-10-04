"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileClock,
  FileText,
  FlaskConical,
  GitBranch,
  History,
  Layers3,
  Loader2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import type { WorkbenchState, RunView } from "@manifest/db";
import type { PlanSpec, FieldError, RecordOutcome } from "@manifest/core";
import { CATALOG } from "@manifest/core/transforms";
import { MappingEditor } from "./mapping-editor";
const navigation = [
  { id: "overview", href: "/", label: "Overview", icon: Layers3 },
  { id: "schemas", href: "/schemas", label: "Schemas & source", icon: Table2 },
  { id: "agent", href: "/agent", label: "Planning agent", icon: Sparkles },
  { id: "plans", href: "/plans", label: "Migration plans", icon: GitBranch },
  { id: "runs", href: "/runs", label: "Runs & quarantine", icon: FlaskConical },
  {
    id: "target",
    href: "/target",
    label: "Target & reconciliation",
    icon: Database,
  },
  { id: "history", href: "/history", label: "Activity log", icon: History },
];
const titles: Record<string, [string, string]> = {
  overview: ["Migration overview", "One dataset. Every record accounted for."],
  schemas: ["Inspect the source", "Understand the data before it moves."],
  agent: [
    "Your migration planning agent",
    "An informed proposal, with every tool call visible.",
  ],
  plans: [
    "Review the migration plan",
    "Explicit mappings. Immutable versions. Your decision.",
  ],
  runs: [
    "Validate before you migrate",
    "A repeatable inspection with evidence for every held record.",
  ],
  target: [
    "The destination ledger",
    "Verify what landed. Recall exactly what you loaded.",
  ],
  history: [
    "The full paper trail",
    "An append-only record of every decision and operation.",
  ],
};
const fmt = (value: unknown) =>
  value === null || value === undefined ? "—" : String(value);
const time = (value: unknown) =>
  new Date(String(value)).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function Stamp({ status }: { status: string }) {
  const color = ["accepted", "approved", "succeeded", "matched"].includes(
    status,
  )
    ? "green"
    : ["rejected", "failed", "mismatch"].includes(status)
      ? "amber"
      : status === "running"
        ? "blue"
        : "neutral";
  return (
    <span className={`stamp ${color}`}>
      <span className="status-dot" />
      {status.replaceAll("_", " ")}
    </span>
  );
}
function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Pager({
  page,
  total,
  onChange,
  size = 15,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pager">
      <span>
        {total
          ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total} records`
          : "0 records"}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {page + 1} / {pages}
        </span>
        <button
          className="icon-button"
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
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
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Sign in to continue.");
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "The operation failed.");
  return data as T;
}
export function WorkbenchApp({
  view,
  selectedId,
}: {
  view: string;
  selectedId?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [actor, setActor] = useState("");
  const [chosenPlan, setChosenPlan] = useState<string>();
  const [run, setRun] = useState<RunView | null>(null);
  const [modal, setModal] = useState<
    "approve" | "rollback" | "evidence" | null
  >(null);
  const [evidence, setEvidence] = useState<RecordOutcome | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [fault, setFault] = useState(false);
  const [editor, setEditor] = useState("");
  const [summary, setSummary] = useState("");
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState("email_addr");
  const refresh = useCallback(async () => {
    try {
      const next = await api<WorkbenchState>("state");
      setState(next);
      setError("");
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workbench");
      return null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    setActor(localStorage.getItem("manifest-operator") ?? "");
  }, [refresh]);
  const runningSession = state?.sessions.some((s) => s.status === "running");
  useEffect(() => {
    if (!runningSession) return;
    const interval = setInterval(() => {
      void refresh();
    }, 1200);
    return () => clearInterval(interval);
  }, [runningSession, refresh]);
  useEffect(() => {
    setPage(0);
    setFilter("");
    setCode("");
    setEditing(false);
  }, [view, selectedId]);
  const plan =
    state?.plans.find(
      (p) => p.id === (view === "target" ? chosenPlan : selectedId),
    ) ??
    (view === "target" ? state?.plans.find((p) => p.approval) : undefined) ??
    state?.plans[0];
  const runId =
    view === "runs" && selectedId
      ? selectedId
      : (state?.runs.find(
          (r) => r.planVersionId === plan?.id && r.kind === "dry_run",
        )?.id ?? state?.runs[0]?.id);
  useEffect(() => {
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
        if (!cancelled) setError(String(e.message));
      });
    return () => {
      cancelled = true;
    };
  }, [runId, state?.runs.length]);
  useEffect(() => {
    if (plan) {
      setAnswers(plan.answers);
      setEditor(JSON.stringify(plan.spec, null, 2));
      setSummary("");
    }
  }, [plan?.id]); // Immutable versions make the id a complete dependency.
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
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  };
  const draft = () =>
    void act<{ id: string }>(
      "Drafting proposal",
      "agent",
      { answers, basePlanId: plan?.id },
      () => {
        setNotice("Planner started. Its inspection trace will appear below.");
        router.push("/agent");
      },
    );
  const dry = () =>
    plan &&
    void act<RunView>(
      "Running inspection",
      "dry-run",
      { planId: plan.id, startedBy: actor },
      (r) => {
        setRun(r);
        router.push(`/runs/${r.id}`);
        setNotice("Dry run complete. The mock target was not changed.");
      },
    );
  const execute = () =>
    plan &&
    void act<{ run: RunView; noop: boolean }>(
      "Executing migration",
      "execute",
      {
        planId: plan.id,
        startedBy: actor,
        ...(fault ? { failAfterBatch: 3 } : {}),
      },
      (r) => {
        setRun(r.run);
        router.push(`/runs/${r.run.id}`);
        setNotice(
          r.noop
            ? "Already loaded. This retry made no changes."
            : r.run.status === "failed"
              ? "Interrupted after committed batches. Turn off the simulator and retry safely."
              : "Migration completed. Reconciliation is available in the target ledger.",
        );
      },
    );
  const execution = state?.runs.find(
    (r) => r.kind === "execution" && r.status !== "rolled_back",
  );
  const latestReconciliation = state?.reconciliations.find(
    (r) =>
      r.lineageId ===
      (execution?.lineageId ??
        state?.runs.find((r) => r.kind === "execution")?.lineageId),
  );
  const [title, subtitle] = titles[view]!;
  const counts = run?.result.counts ?? state?.runs[0]?.counts;
  const canDry = !!plan && !busy && !!actor.trim();
  const dryForApproval = state?.runs.find(
    (r) =>
      r.kind === "dry_run" &&
      r.planVersionId === plan?.id &&
      r.status === "succeeded",
  );
  const questionCount =
    plan?.proposal.questions.filter((q) => q.blocking && !plan.answers[q.id])
      .length ?? 0;
  const canApprove = !!dryForApproval && !plan?.approval && questionCount === 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={22} />
          </span>
          <span>
            manifest<span className="brand-subtitle">MIGRATION WORKBENCH</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-letter">LC</span>
          <div>
            Legacy CRM migration<small>Single-source workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">WORKBENCH</p>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              aria-label={n.label}
              title={n.label}
              className={`nav-link ${view === n.id ? "active" : ""}`}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.id === "plans" && !!state?.plans.length && (
                <span className="nav-count">{state.plans.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="bounded-note">
            <ShieldCheck size={18} />
            <div>
              Bounded by design
              <small>1 source · 1 target · 1,000 rows max</small>
            </div>
          </div>
          <div className="operator-avatar">OP</div>
          <div className="operator-label">
            Operator<small>{actor || "Enter your name above"}</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <ChevronRight size={13} />
            <span>{navigation.find((n) => n.id === view)?.label}</span>
          </div>
          <label className="header-operator">
            <span>OPERATOR</span>
            <input
              aria-label="Operator name"
              value={actor}
              placeholder="Enter your name"
              onChange={(e) => {
                setActor(e.target.value);
                localStorage.setItem("manifest-operator", e.target.value);
              }}
              maxLength={100}
            />
          </label>
          <span className="environment">
            <span className="status-dot" />
            MOCK TARGET <span className="env-divider">/</span> POSTGRESQL
          </span>
        </header>
        <main className="main-content">
          <div className="page-header">
            <div>
              <p className="eyebrow">LEGACY CRM → CUSTOMER REGISTRY</p>
              <h1>{title}</h1>
              <p className="subtitle">{subtitle}</p>
            </div>
            <div className="page-actions">
              {view === "overview" || view === "agent" ? (
                <button
                  className="button primary"
                  onClick={draft}
                  disabled={!!busy || runningSession || !state}
                >
                  <Sparkles size={16} />
                  {runningSession
                    ? "Planner running…"
                    : plan
                      ? "Re-draft plan"
                      : "Draft migration plan"}
                  <ArrowRight size={16} />
                </button>
              ) : view === "plans" && plan ? (
                <button
                  className="button primary"
                  disabled={!canDry}
                  onClick={dry}
                >
                  <FlaskConical size={16} />
                  Run dry run
                </button>
              ) : (
                <span className="document-ref">WORKSPACE / 001</span>
              )}
            </div>
          </div>
          {error && (
            <div className="alert error" role="alert">
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
            <div className="alert success" role="status">
              {notice}
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
            <div className="working" role="status">
              <Loader2 className="spin" size={16} />
              {busy}…
            </div>
          )}
          {!state ? (
            <div className="panel">
              <Empty
                title={
                  error ? "Connect your database" : "Opening the workbench…"
                }
                description={
                  error
                    ? "Configure the Neon connection, apply the migrations, and seed the bounded dataset. Your source stays in PostgreSQL."
                    : "Reading the migration workspace."
                }
              >
                <code className="setup-command">
                  pnpm db:deploy && pnpm db:seed
                </code>
                <button
                  className="button secondary"
                  onClick={() => void refresh()}
                >
                  Refresh connection
                </button>
              </Empty>
            </div>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <section className="count-grid">
                    {[
                      { label: "Source", value: state.dataset.recordCount },
                      {
                        label: "Transformed",
                        value: counts?.transformed ?? "—",
                      },
                      { label: "Accepted", value: counts?.accepted ?? "—" },
                      { label: "Rejected", value: counts?.rejected ?? "—" },
                    ].map((item) => (
                      <div className="count-card" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="panel-header">
                      <h2>Dataset</h2>
                    </div>
                    <table className="dataset-table">
                      <tbody>
                        <tr>
                          <th>Source</th>
                          <td>
                            <code>legacy_crm.customers</code>
                          </td>
                        </tr>
                        <tr>
                          <th>Target</th>
                          <td>
                            <code>target.customers</code>
                          </td>
                        </tr>
                        <tr>
                          <th>Sample size</th>
                          <td>
                            {state.dataset.recordCount} / {state.maxRecords}{" "}
                            records
                          </td>
                        </tr>
                        <tr>
                          <th>Current target</th>
                          <td>
                            {state.target.length} rows ·{" "}
                            {
                              state.target.filter(
                                (r) => r._migration_lineage_id === null,
                              ).length
                            }{" "}
                            pre-existing
                          </td>
                        </tr>
                        <tr>
                          <th>Planner</th>
                          <td>
                            {state.provider === "groq"
                              ? "Groq"
                              : "Offline deterministic planner"}
                          </td>
                        </tr>
                        <tr>
                          <th>Latest plan</th>
                          <td>
                            {plan ? (
                              <>
                                Version {plan.version} ·{" "}
                                <Stamp
                                  status={plan.approval ? "approved" : "draft"}
                                />
                              </>
                            ) : (
                              "No plan yet"
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>
                  <section className="panel">
                    <div className="panel-header">
                      <h2>Migration workflow</h2>
                    </div>
                    <ol className="workflow-list">
                      <li>
                        <Link href="/schemas">
                          Inspect schemas and sample records.
                        </Link>
                      </li>
                      <li>
                        <Link href="/agent">
                          Draft a plan and answer the business questions.
                        </Link>
                      </li>
                      <li>
                        <Link href="/plans">
                          Review the mappings and run a dry run.
                        </Link>
                      </li>
                      <li>
                        <Link href="/runs">
                          Inspect rejected records and their field errors.
                        </Link>
                      </li>
                      <li>
                        <Link href="/plans">
                          Approve the exact version and acknowledge its risks.
                        </Link>
                      </li>
                      <li>
                        <Link href="/target">
                          Execute, reconcile totals, and roll back when needed.
                        </Link>
                      </li>
                    </ol>
                  </section>
                </>
              )}
              {view === "schemas" && (
                <>
                  <div className="schema-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Source schema</h2>
                        <span className="stamp neutral">13 fields</span>
                      </div>
                      <code className="schema-name">legacy_crm.customers</code>
                      <div className="schema-fields">
                        {state.sourceSchema.fields.map((f) => (
                          <button
                            key={f.name}
                            className={profile === f.name ? "selected" : ""}
                            onClick={() => setProfile(f.name)}
                          >
                            <code>{f.name}</code>
                            <span>string / null</span>
                            <ChevronRight size={13} />
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Target schema</h2>
                        <span className="stamp green">Strict constraints</span>
                      </div>
                      <code className="schema-name">target.customers</code>
                      <div className="target-fields">
                        {state.targetSchema.fields.map((f) => (
                          <div key={f.name}>
                            <code>{f.name}</code>
                            <span className="field-type">{f.type}</span>
                            <div>
                              {f.required && (
                                <span className="tiny-tag">required</span>
                              )}
                              {f.unique && (
                                <span className="tiny-tag green">unique</span>
                              )}
                              {f.enum && <small>{f.enum.join(" / ")}</small>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                  <Profile records={state.dataset.records} field={profile} />
                  <section className="panel">
                    <div className="panel-header">
                      <h2>Source sample</h2>
                      <span className="document-ref">
                        {state.dataset.recordCount} / {state.maxRecords} ROW
                        LIMIT
                      </span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>ROW</th>
                            {state.sourceSchema.fields.map((f) => (
                              <th key={f.name}>
                                <button
                                  className="table-heading-button"
                                  onClick={() => setProfile(f.name)}
                                >
                                  {f.name}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {state.dataset.records
                            .slice(page * 15, (page + 1) * 15)
                            .map((r) => (
                              <tr key={r.rowIndex}>
                                <td className="muted">{r.rowIndex + 1}</td>
                                {state.sourceSchema.fields.map((f) => (
                                  <td className="mono" key={f.name}>
                                    {fmt(r.payload[f.name])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <Pager
                      page={page}
                      total={state.dataset.recordCount}
                      onChange={setPage}
                    />
                  </section>
                </>
              )}
              {view === "agent" && (
                <>
                  <div className="agent-banner">
                    <span className="agent-orb">
                      <Sparkles size={22} />
                    </span>
                    <div>
                      <h3>
                        {state.provider === "groq"
                          ? "Groq planning agent"
                          : "Offline deterministic planner"}
                      </h3>
                      <p>
                        {state.provider === "groq"
                          ? "Tool-restricted reasoning with independently measured mapping tests."
                          : "A reproducible demo planner using the same inspection and validation tools. Add a Groq key for model-driven proposals."}
                      </p>
                    </div>
                    <span className="stamp green">Read-only tools</span>
                  </div>
                  <div className="agent-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Inspection trace</h2>
                        {state.sessions[0] && (
                          <Stamp status={state.sessions[0].status} />
                        )}
                      </div>
                      {!state.sessions.length ? (
                        <Empty
                          title="A proposal starts with evidence."
                          description="Ask the planner to inspect the schemas, profile the fields, and trial the supported mappings."
                        />
                      ) : (
                        <div className="tool-trace">
                          {state.sessions[0]!.calls.map((c) => (
                            <details key={c.id}>
                              <summary>
                                <span className="tool-seq">
                                  {String(c.seq).padStart(2, "0")}
                                </span>
                                {c.rejected ? (
                                  <X size={14} />
                                ) : (
                                  <Check size={14} />
                                )}
                                <code>{c.tool}</code>
                                <small>{c.durationMs} ms</small>
                              </summary>
                              <div>
                                <p className="eyebrow">ARGUMENTS</p>
                                <pre>{JSON.stringify(c.args, null, 2)}</pre>
                                <p className="eyebrow">RESULT</p>
                                <pre>{JSON.stringify(c.result, null, 2)}</pre>
                              </div>
                            </details>
                          ))}
                          {state.sessions[0]?.status === "running" && (
                            <p className="trace-running">
                              <Loader2 size={15} className="spin" />
                              Inspecting and testing…
                            </p>
                          )}
                          {state.sessions[0]?.error && (
                            <p className="error trace-running">
                              {state.sessions[0].error}
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Business decisions</h2>
                        <span className="document-ref">HUMAN INPUT</span>
                      </div>
                      {!plan ? (
                        <Empty
                          title="Questions will appear here."
                          description="The planner flags choices it cannot safely infer from the schema."
                        />
                      ) : (
                        <div className="question-list">
                          {plan.proposal.questions.map((q) => (
                            <label key={q.id}>
                              <span>{q.question}</span>
                              <small>{q.why}</small>
                              <select
                                aria-label={q.question}
                                value={answers[q.id] ?? ""}
                                onChange={(e) =>
                                  setAnswers((a) => ({
                                    ...a,
                                    [q.id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose an answer…</option>
                                {q.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <button
                            className="button primary full"
                            onClick={draft}
                            disabled={!!busy || runningSession}
                          >
                            <Sparkles size={16} />
                            Re-draft with answers
                            <ArrowRight size={16} />
                          </button>
                          <p className="form-hint">
                            Answers become part of a new immutable plan version.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                  {plan && (
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Proposed migration</h2>
                        <Link href={`/plans/${plan.id}`} className="text-link">
                          Review v{plan.version}
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                      <p className="proposal-summary">
                        {plan.proposal.summary}
                      </p>
                      <div className="finding-grid">
                        {plan.proposal.incompatibilities.map((i, index) => (
                          <div key={index}>
                            <span className="tiny-tag">
                              {i.kind.replaceAll("_", " ")}
                            </span>
                            <code>{i.field}</code>
                            <p>{i.detail}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
              {view === "plans" &&
                (!plan ? (
                  <section className="panel">
                    <Empty
                      title="No plans yet."
                      description="Generate your first proposal to begin reviewing field mappings."
                    >
                      <button
                        className="button primary"
                        onClick={draft}
                        disabled={!!busy || runningSession}
                      >
                        <Sparkles size={16} />
                        Draft migration plan
                      </button>
                    </Empty>
                  </section>
                ) : (
                  <>
                    <div className="version-strip">
                      <div>
                        <GitBranch size={18} />
                        <select
                          aria-label="Plan version"
                          value={plan.id}
                          onChange={(e) =>
                            router.push(`/plans/${e.target.value}`)
                          }
                        >
                          {state.plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              Version {p.version} · {p.authorName}
                            </option>
                          ))}
                        </select>
                        <Stamp status={plan.approval ? "approved" : "draft"} />
                      </div>
                      <code>SHA256 / {plan.specHash.slice(0, 16)}</code>
                    </div>
                    {plan.diff && (
                      <div className="plan-diff">
                        Changes from parent version:{" "}
                        {[
                          ...plan.diff.changedMappings,
                          ...plan.diff.addedMappings.map((f) => `added ${f}`),
                          ...plan.diff.removedMappings.map(
                            (f) => `removed ${f}`,
                          ),
                          ...plan.diff.changedSettings,
                        ].join(", ") ||
                          "Mapping specification unchanged; updated decisions."}
                      </div>
                    )}
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>Field mapping manifest</h2>
                          <p>{plan.changeSummary}</p>
                        </div>
                        <button
                          className="button secondary small"
                          onClick={() => setEditing(!editing)}
                        >
                          {editing ? "Close editor" : "Edit as new version"}
                          <FileText size={14} />
                        </button>
                      </div>
                      {editing ? (
                        <div className="plan-editor">
                          <p>
                            Choose sources and only the supported transform
                            names listed below. Saving validates the entire plan
                            and creates a new draft.
                          </p>
                          <div className="catalog-tags">
                            {Object.keys(CATALOG).map((op) => (
                              <code key={op}>{op}</code>
                            ))}
                          </div>
                          <MappingEditor
                            spec={(() => {
                              try {
                                return JSON.parse(editor) as PlanSpec;
                              } catch {
                                return plan.spec;
                              }
                            })()}
                            sourceFields={state.sourceSchema.fields.map(
                              (f) => f.name,
                            )}
                            onChange={(s) =>
                              setEditor(JSON.stringify(s, null, 2))
                            }
                          />
                          <details className="advanced-editor">
                            <summary>Advanced JSON specification</summary>
                            <label htmlFor="plan-json">
                              Plan specification
                            </label>
                            <textarea
                              id="plan-json"
                              aria-label="Plan specification"
                              spellCheck={false}
                              value={editor}
                              onChange={(e) => setEditor(e.target.value)}
                              rows={24}
                            />
                          </details>
                          <label>
                            Change summary
                            <input
                              value={summary}
                              onChange={(e) => setSummary(e.target.value)}
                              placeholder="Describe the mapping changes"
                              maxLength={500}
                            />
                          </label>
                          <button
                            className="button primary"
                            disabled={
                              !!busy || !actor.trim() || !summary.trim()
                            }
                            onClick={() => {
                              let spec: PlanSpec;
                              try {
                                spec = JSON.parse(editor) as PlanSpec;
                              } catch {
                                setError(
                                  "Plan specification must be valid JSON.",
                                );
                                return;
                              }
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
                                    "Saved a new immutable draft version. It needs its own dry run and approval.",
                                  );
                                },
                              );
                            }}
                          >
                            <GitBranch size={16} />
                            Save new version
                          </button>
                        </div>
                      ) : (
                        <div className="table-scroll">
                          <table className="mapping-table">
                            <thead>
                              <tr>
                                <th>SOURCE FIELD</th>
                                <th />
                                <th>TARGET FIELD</th>
                                <th>TRANSFORMATION PIPELINE</th>
                                <th>TRANSFORM SUCCESS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.spec.mappings.map((m) => (
                                <tr key={m.targetField}>
                                  <td>
                                    <code>
                                      {m.sources.join(" + ") || "— constant —"}
                                    </code>
                                  </td>
                                  <td className="muted">
                                    <ArrowRight size={14} />
                                  </td>
                                  <td>
                                    <code>{m.targetField}</code>
                                  </td>
                                  <td>
                                    <div className="transform-pipeline">
                                      {m.steps.map((s, index) => (
                                        <span key={index}>
                                          <code>
                                            {s.op}
                                            {"part" in s
                                              ? `:${s.part}`
                                              : "value" in s
                                                ? `:${String(s.value)}`
                                                : ""}
                                          </code>
                                          {index < m.steps.length - 1 && (
                                            <ChevronRight size={12} />
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={`measured ${plan.proposal.measured[m.targetField]?.successRate === 1 ? "green" : "amber"}`}
                                    >
                                      {plan.proposal.measured[m.targetField]
                                        ? `${Math.round(plan.proposal.measured[m.targetField]!.successRate * 100)}%`
                                        : "Re-test in dry run"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="mapping-footer">
                        <span>
                          {plan.spec.mappings.length} mapped target fields ·{" "}
                          {plan.spec.unmappedSourceFields.length} explicit
                          source drops
                        </span>
                        <span>As of {plan.spec.asOfDate}</span>
                      </div>
                    </section>
                    <div className="risk-grid">
                      {plan.proposal.risks.map((r) => (
                        <section
                          className={`risk-card ${r.severity}`}
                          key={r.id}
                        >
                          <div>
                            <ShieldCheck size={17} />
                            <span className="tiny-tag">{r.severity} risk</span>
                          </div>
                          <h3>{r.title}</h3>
                          <p>{r.explanation}</p>
                        </section>
                      ))}
                    </div>
                    <section className="approval-bar">
                      <div>
                        <ClipboardCheck size={24} />
                        <div>
                          <h3>
                            {plan.approval
                              ? `Approved by ${plan.approval.approvedBy}`
                              : "Your approval is the execution gate."}
                          </h3>
                          <p>
                            {plan.approval
                              ? `Bound to this version and dry run. Signed ${time(plan.approval.createdAt)}.`
                              : questionCount
                                ? `${questionCount} unresolved business decisions. Answer them in the planning agent, then re-draft.`
                                : !dryForApproval
                                  ? "Enter your operator name and run a dry run before approval."
                                  : "Review the results, acknowledge the high risks, and sign this exact plan."}
                          </p>
                        </div>
                      </div>
                      <button
                        className="button primary"
                        disabled={!canApprove || !!busy || !actor.trim()}
                        onClick={() => {
                          setAcknowledged([]);
                          setModal("approve");
                        }}
                      >
                        <ShieldCheck size={16} />
                        {plan.approval
                          ? "Version approved"
                          : "Review & approve"}
                      </button>
                    </section>
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Version history</h2>
                        <span className="document-ref">APPEND-ONLY</span>
                      </div>
                      <div className="version-list">
                        {state.plans.map((p) => (
                          <Link key={p.id} href={`/plans/${p.id}`}>
                            <span className="version-number">v{p.version}</span>
                            <div>
                              <strong>{p.changeSummary}</strong>
                              <small>
                                {p.authorName} · {time(p.createdAt)}
                              </small>
                            </div>
                            <Stamp status={p.approval ? "approved" : "draft"} />
                            <ChevronRight size={16} />
                          </Link>
                        ))}
                      </div>
                    </section>
                  </>
                ))}
              {view === "runs" &&
                (!run ? (
                  <section className="panel">
                    <Empty
                      title="Every dry run leaves a record."
                      description="Generate a plan, enter your operator name, and run an inspection to see accepted rows and quarantine evidence."
                    >
                      <Link href="/plans" className="button primary">
                        Review plans
                        <ArrowRight size={16} />
                      </Link>
                    </Empty>
                  </section>
                ) : (
                  <>
                    <div className="version-strip">
                      <div>
                        <FileClock size={18} />
                        <select
                          aria-label="Run history"
                          value={run.id}
                          onChange={(e) =>
                            router.push(`/runs/${e.target.value}`)
                          }
                        >
                          {state.runs.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.kind === "dry_run" ? "Dry run" : "Execution"} ·{" "}
                              {time(r.startedAt)} · {r.status}
                            </option>
                          ))}
                        </select>
                        <Stamp status={run.status} />
                      </div>
                      <span className="document-ref">
                        ATTEMPT / {String(run.attempt).padStart(2, "0")}
                      </span>
                    </div>
                    <section className="count-grid">
                      {Object.entries(run.result.counts)
                        .filter(([k]) => k !== "rejectedByStage")
                        .map(([key, value]) => (
                          <div className="count-card" key={key}>
                            <div>
                              <span>{key.toUpperCase()}</span>
                            </div>
                            <strong
                              className={
                                key === "accepted"
                                  ? "green"
                                  : key === "rejected"
                                    ? "amber"
                                    : ""
                              }
                            >
                              {String(value)}
                            </strong>
                            <p>
                              {key === "rejected"
                                ? "Quarantined with evidence"
                                : key === "accepted"
                                  ? "Cleared for migration"
                                  : key === "transformed"
                                    ? "Mapping pipelines completed"
                                    : "Staged source records"}
                            </p>
                          </div>
                        ))}
                    </section>
                    <div className="determinism-bar">
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>
                          {run.kind === "dry_run"
                            ? "Deterministic inspection"
                            : "Approved dry-run snapshot"}
                        </strong>
                        <span>
                          {run.result.counts.source} source ={" "}
                          {run.result.counts.accepted} accepted +{" "}
                          {run.result.counts.rejected} held
                        </span>
                      </div>
                      <code title={run.result.resultHash}>
                        SHA256 / {run.result.resultHash.slice(0, 16)}
                      </code>
                    </div>
                    {run.kind === "execution" && (
                      <section className="execution-summary">
                        <div>
                          <span className="eyebrow">INSERTED THIS ATTEMPT</span>
                          <strong>{run.insertedCount}</strong>
                        </div>
                        <div>
                          <span className="eyebrow">
                            ALREADY LOADED · SKIPPED
                          </span>
                          <strong>{run.skippedExisting}</strong>
                        </div>
                        <div>
                          <span className="eyebrow">COMMITTED BATCHES</span>
                          <strong>{run.batchesCommitted}</strong>
                        </div>
                        <p>
                          {run.error ??
                            "Each target row carries the migration lineage and its expected content hash."}
                        </p>
                        {run.status === "failed" && (
                          <button
                            className="button primary"
                            disabled={!!busy || !actor.trim()}
                            onClick={() => {
                              const runPlan = state.plans.find(
                                (p) => p.id === run.planVersionId,
                              )!;
                              void act<{ run: RunView }>(
                                "Retrying migration",
                                "execute",
                                { planId: runPlan.id, startedBy: actor },
                                (r) => {
                                  setRun(r.run);
                                  router.push(`/runs/${r.run.id}`);
                                  setNotice(
                                    `Retry complete: ${r.run.insertedCount} inserted, ${r.run.skippedExisting} already loaded.`,
                                  );
                                },
                              );
                            }}
                          >
                            <RotateCcw size={16} />
                            Retry migration safely
                          </button>
                        )}
                      </section>
                    )}
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>Quarantine manifest</h2>
                          <p>
                            Held records retain their source values and the
                            exact failure.
                          </p>
                        </div>
                        <span className="stamp amber">
                          {run.result.counts.rejected} held
                        </span>
                      </div>
                      <div className="table-toolbar">
                        <label className="search-input">
                          <Search size={16} />
                          <input
                            placeholder="Search record or field…"
                            aria-label="Search quarantine"
                            value={filter}
                            onChange={(e) => {
                              setFilter(e.target.value);
                              setPage(0);
                            }}
                          />
                        </label>
                        <select
                          aria-label="Filter error code"
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value);
                            setPage(0);
                          }}
                        >
                          <option value="">All error codes</option>
                          {[
                            ...new Set(
                              run.result.fieldErrors.map((e) => e.code),
                            ),
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <Quarantine
                        run={run}
                        page={page}
                        filter={filter}
                        code={code}
                        onPage={setPage}
                        onOpen={(o) => {
                          setEvidence(o);
                          setModal("evidence");
                        }}
                      />
                    </section>
                    {run.kind === "dry_run" && (
                      <div className="approval-bar">
                        <div>
                          <FlaskConical size={22} />
                          <div>
                            <h3>The mock target is untouched.</h3>
                            <p>
                              Review the evidence, then approve this plan
                              version to enable execution.
                            </p>
                          </div>
                        </div>
                        <Link
                          className="button secondary"
                          href={`/plans/${run.planVersionId}`}
                        >
                          Review this plan
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    )}
                  </>
                ))}
              {view === "target" && (
                <>
                  <section className="target-banner">
                    <div>
                      <div className="database-icon target">
                        <Database size={24} />
                      </div>
                      <div>
                        <span className="eyebrow">
                          MOCK TARGET / CUSTOMER REGISTRY
                        </span>
                        <h2>
                          {state.target.length} records at the destination
                        </h2>
                        <p>
                          {
                            state.target.filter(
                              (r) => r._migration_lineage_id === null,
                            ).length
                          }{" "}
                          pre-existing ·{" "}
                          {
                            state.target.filter(
                              (r) => r._migration_lineage_id !== null,
                            ).length
                          }{" "}
                          migration-owned
                        </p>
                      </div>
                    </div>
                    <span className="stamp neutral">target.customers</span>
                  </section>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <h2>Reconciliation ledger</h2>
                        {latestReconciliation && (
                          <Stamp status={latestReconciliation.status} />
                        )}
                      </div>
                      {!latestReconciliation ? (
                        <Empty
                          title="Verify every landed row."
                          description="After execution, the ledger compares counts, key coverage, row content, and the total credit limit."
                        />
                      ) : (
                        <div className="ledger">
                          {latestReconciliation.report.checks.map((c) => (
                            <div key={c.label}>
                              <span>{c.label}</span>
                              <span>
                                {c.expected.toLocaleString()}
                                <small>expected</small>
                              </span>
                              <span>
                                {c.actual.toLocaleString()}
                                <small>actual</small>
                              </span>
                              {c.matched ? (
                                <CheckCircle2 size={17} className="green" />
                              ) : (
                                <X size={17} className="amber" />
                              )}
                            </div>
                          ))}
                          <p>
                            {latestReconciliation.report.missing.length} missing
                            keys ·{" "}
                            {latestReconciliation.report.unexpected.length}{" "}
                            unexpected keys ·{" "}
                            {latestReconciliation.report.mismatches.length}{" "}
                            content mismatches
                          </p>
                          <small>
                            Verified {time(latestReconciliation.createdAt)}
                            {latestReconciliation.report.rolledBack
                              ? " · after rollback"
                              : ""}
                          </small>
                        </div>
                      )}
                    </section>
                    <section className="panel next-panel">
                      <div className="panel-header">
                        <h2>Migration controls</h2>
                        <ShieldCheck size={18} />
                      </div>
                      <div className="control-body">
                        <label className="form-label">
                          Plan to execute
                          <select
                            aria-label="Execution plan"
                            value={plan?.id ?? ""}
                            onChange={(e) => setChosenPlan(e.target.value)}
                          >
                            {!state.plans.length && (
                              <option value="">No plan yet</option>
                            )}
                            {state.plans.map((p) => (
                              <option value={p.id} key={p.id}>
                                Version {p.version} ·{" "}
                                {p.approval ? "approved" : "draft"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p>
                          {plan?.approval
                            ? "This exact version has a signed approval. All accepted records will be inserted in batches of 50."
                            : "Create a dry run and approve the plan to enable migration."}
                        </p>
                        {state.faultInjection && (
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={fault}
                              onChange={(e) => setFault(e.target.checked)}
                            />
                            Simulate interruption after batch 3
                          </label>
                        )}
                        <button
                          className="button primary full"
                          onClick={execute}
                          disabled={!!busy || !actor.trim() || !plan?.approval}
                        >
                          <Play size={16} />
                          {execution?.status === "failed"
                            ? "Retry approved migration"
                            : "Execute approved migration"}
                        </button>
                        {execution && (
                          <div className="secondary-controls">
                            <button
                              className="button secondary full"
                              disabled={!!busy || !actor.trim()}
                              onClick={() =>
                                void act(
                                  "Reconciling target",
                                  "reconcile",
                                  { lineageId: execution.lineageId, actor },
                                  () =>
                                    setNotice("Reconciliation report updated."),
                                )
                              }
                            >
                              <ArrowLeftRight size={16} />
                              Reconcile totals
                            </button>
                            <button
                              className="button danger full"
                              disabled={
                                !!busy ||
                                !actor.trim() ||
                                execution.status === "running"
                              }
                              onClick={() => {
                                setReason("");
                                setModal("rollback");
                              }}
                            >
                              <RotateCcw size={16} />
                              Roll back migration
                            </button>
                          </div>
                        )}
                        <p className="form-hint">
                          Pre-existing records are excluded from rollback.
                        </p>
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-header">
                      <h2>Customer registry</h2>
                      <span className="document-ref">
                        READ-ONLY TARGET BROWSER
                      </span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>ORIGIN</th>
                            <th>LEGACY ID</th>
                            <th>NAME</th>
                            <th>EMAIL</th>
                            <th>STATUS</th>
                            <th>COUNTRY</th>
                            <th>CREDIT LIMIT</th>
                            <th>CONSENT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.target
                            .slice(page * 15, (page + 1) * 15)
                            .map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <span
                                    className={`tiny-tag ${r._migration_lineage_id ? "green" : ""}`}
                                  >
                                    {r._migration_lineage_id
                                      ? "landed"
                                      : "pre-existing"}
                                  </span>
                                </td>
                                <td className="mono">{fmt(r.legacy_id)}</td>
                                <td>
                                  {fmt(r.first_name)} {r.last_name}
                                </td>
                                <td className="mono">{r.email}</td>
                                <td>{r.status}</td>
                                <td className="mono">{r.country_code}</td>
                                <td className="mono">
                                  {(Number(r.credit_limit_cents) / 100).toFixed(
                                    2,
                                  )}
                                </td>
                                <td>{r.marketing_opt_in ? "Yes" : "No"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <Pager
                      page={page}
                      total={state.target.length}
                      onChange={setPage}
                    />
                  </section>
                </>
              )}
              {view === "history" && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Activity register</h2>
                      <p>
                        Database rules prevent modification or deletion of these
                        events.
                      </p>
                    </div>
                    <span className="stamp green">Append-only</span>
                  </div>
                  <div className="table-toolbar">
                    <label className="search-input">
                      <Search size={16} />
                      <input
                        placeholder="Filter event or operator…"
                        aria-label="Filter history"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </label>
                    <span className="document-ref">
                      LATEST {state.history.length} EVENTS
                    </span>
                  </div>
                  <div className="history-list">
                    {state.history
                      .filter((e) =>
                        `${e.type} ${e.actor}`
                          .toLowerCase()
                          .includes(filter.toLowerCase()),
                      )
                      .map((e) => (
                        <details key={e.id}>
                          <summary>
                            <span className="history-event-icon">
                              {e.type.includes("approved") ? (
                                <ClipboardCheck size={17} />
                              ) : e.type.includes("rollback") ? (
                                <RotateCcw size={17} />
                              ) : e.type.includes("agent") ? (
                                <Sparkles size={17} />
                              ) : (
                                <FileClock size={17} />
                              )}
                            </span>
                            <div>
                              <strong>{e.type.replaceAll("_", " ")}</strong>
                              <small>
                                {e.actor} · event #{e.id}
                              </small>
                            </div>
                            <time>{time(e.createdAt)}</time>
                            <ChevronDown size={15} />
                          </summary>
                          <pre>{JSON.stringify(e.payload, null, 2)}</pre>
                        </details>
                      ))}
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="footer">
            <span>MANIFEST / CONTROLLED DATA MOVEMENT</span>
            <span>One source. One target. A complete paper trail.</span>
          </footer>
        </main>
      </div>
      {modal === "approve" && plan && dryForApproval && (
        <Modal
          title={`Approve migration plan v${plan.version}`}
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            Your signature binds to the exact plan fingerprint and dry-run
            result below.
          </p>
          <code className="approval-hash">{plan.specHash}</code>
          <div className="modal-risks">
            {plan.proposal.risks
              .filter((r) => r.severity === "high")
              .map((r) => (
                <label className="check-label" key={r.id}>
                  <input
                    type="checkbox"
                    checked={acknowledged.includes(r.id)}
                    onChange={(e) =>
                      setAcknowledged((a) =>
                        e.target.checked
                          ? [...a, r.id]
                          : a.filter((i) => i !== r.id),
                      )
                    }
                  />
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.explanation}</small>
                  </span>
                </label>
              ))}
          </div>
          <p className="form-hint">
            Signed by {actor || "Enter your operator name"} · Dry run{" "}
            {dryForApproval.id.slice(0, 8)}
          </p>
          <button
            className="button primary full"
            disabled={
              !!busy ||
              !actor.trim() ||
              plan.proposal.risks
                .filter((r) => r.severity === "high")
                .some((r) => !acknowledged.includes(r.id))
            }
            onClick={() =>
              void act(
                "Approving plan",
                "approve",
                {
                  planId: plan.id,
                  dryRunId: dryForApproval.id,
                  specHash: plan.specHash,
                  approvedBy: actor,
                  acknowledgedRisks: acknowledged,
                },
                () => {
                  setModal(null);
                  setNotice(
                    "Plan approved. Execution is now available in the target ledger.",
                  );
                },
              )
            }
          >
            <ShieldCheck size={16} />
            Sign & approve this version
          </button>
        </Modal>
      )}
      {modal === "rollback" && execution && (
        <Modal title="Recall this migration" onClose={() => setModal(null)}>
          <p className="modal-intro">
            Remove only the rows owned by migration{" "}
            <code>{execution.lineageId.slice(0, 8)}</code>. The{" "}
            {
              state?.target.filter((r) => r._migration_lineage_id === null)
                .length
            }{" "}
            pre-existing rows will remain. Rollback is refused if migrated
            content was edited.
          </p>
          <label className="form-label">
            Reason for rollback
            <textarea
              aria-label="Reason for rollback"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </label>
          <button
            className="button danger full"
            disabled={!!busy || !reason.trim()}
            onClick={() =>
              void act<{ rowsDeleted: number }>(
                "Rolling back migration",
                "rollback",
                { lineageId: execution.lineageId, requestedBy: actor, reason },
                (r) => {
                  setModal(null);
                  setNotice(
                    `Rollback completed. ${r.rowsDeleted} migration-owned rows removed.`,
                  );
                },
              )
            }
          >
            <RotateCcw size={16} />
            Confirm rollback
          </button>
        </Modal>
      )}
      {modal === "evidence" && evidence && run && (
        <Modal
          title={`Record evidence · ${evidence.recordKey || `row ${evidence.rowIndex + 1}`}`}
          onClose={() => setModal(null)}
        >
          <div className="evidence-meta">
            <Stamp status={evidence.status} />
            <span>Source row {evidence.rowIndex + 1}</span>
          </div>
          <h3 className="evidence-heading">Field errors</h3>
          {run.result.fieldErrors
            .filter((e) => e.rowIndex === evidence.rowIndex)
            .map((e, i) => (
              <div className="evidence-error" key={i}>
                <span className="tiny-tag amber">{e.code}</span>
                <strong>{e.targetField}</strong>
                <p>{e.message}</p>
                <code>Original: {JSON.stringify(e.sourceValues)}</code>
                <small>
                  {e.stage}
                  {e.op ? ` · step ${(e.stepIndex ?? 0) + 1} · ${e.op}` : ""}
                </small>
              </div>
            ))}
          <h3 className="evidence-heading">Transformation trace</h3>
          {evidence.trace.map((t) => (
            <details className="trace-detail" key={t.targetField}>
              <summary>
                <code>{t.targetField}</code>
                <ChevronDown size={14} />
              </summary>
              {t.steps.map((step, index) => (
                <div key={index} className={!step.ok ? "step failed" : "step"}>
                  <code>{step.op}</code>
                  <span>{JSON.stringify(step.input)}</span>
                  <ArrowRight size={12} />
                  <span>{JSON.stringify(step.output)}</span>
                  {step.ok ? <Check size={14} /> : <X size={14} />}
                </div>
              ))}
            </details>
          ))}
          <h3 className="evidence-heading">Candidate target row</h3>
          <pre>{JSON.stringify(evidence.row, null, 2)}</pre>
        </Modal>
      )}
    </div>
  );
}
function Profile({
  records,
  field,
}: {
  records: WorkbenchState["dataset"]["records"];
  field: string;
}) {
  const values = records.map((r) => r.payload[field]);
  const empty = values.filter((v) => !v?.trim()).length;
  const freq = new Map<string, number>();
  for (const v of values) if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  return (
    <section className="profile-panel">
      <div>
        <span className="eyebrow">FIELD PROFILE</span>
        <h3>{field}</h3>
      </div>
      <div>
        <strong>{Math.round((empty / records.length) * 100)}%</strong>
        <small>empty values</small>
      </div>
      <div>
        <strong>{freq.size}</strong>
        <small>distinct values</small>
      </div>
      <div>
        <strong>{Math.max(0, ...values.map((v) => v?.length ?? 0))}</strong>
        <small>max characters</small>
      </div>
      <div className="profile-values">
        <span className="eyebrow">MOST FREQUENT</span>
        {[...freq]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([value, count]) => (
            <span key={value}>
              <code>{value}</code>
              <small>×{count}</small>
            </span>
          ))}
      </div>
    </section>
  );
}
function Quarantine({
  run,
  page,
  filter,
  code,
  onPage,
  onOpen,
}: {
  run: RunView;
  page: number;
  filter: string;
  code: string;
  onPage: (page: number) => void;
  onOpen: (outcome: RecordOutcome) => void;
}) {
  const byRow = new Map<number, FieldError[]>();
  for (const e of run.result.fieldErrors)
    byRow.set(e.rowIndex, [...(byRow.get(e.rowIndex) ?? []), e]);
  const rejected = run.result.outcomes.filter(
    (o) =>
      o.status === "rejected" &&
      (byRow.get(o.rowIndex) ?? []).some(
        (e) =>
          (!code || e.code === code) &&
          `${o.recordKey} ${e.targetField} ${e.code}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
      ),
  );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ROW</th>
              <th>RECORD KEY</th>
              <th>FIELD</th>
              <th>ERROR CODE</th>
              <th>ORIGINAL VALUE</th>
              <th>EVIDENCE</th>
            </tr>
          </thead>
          <tbody>
            {rejected.slice(page * 15, (page + 1) * 15).map((o) => {
              const errs = byRow.get(o.rowIndex) ?? [];
              const e = errs.find((e) => !code || e.code === code)!;
              return (
                <tr key={o.rowIndex}>
                  <td className="muted">{o.rowIndex + 1}</td>
                  <td className="mono">{o.recordKey || "(blank)"}</td>
                  <td className="mono">
                    {e.targetField}
                    {errs.length > 1 && (
                      <span className="tiny-tag">+{errs.length - 1}</span>
                    )}
                  </td>
                  <td>
                    <span className="error-code">{e.code}</span>
                  </td>
                  <td className="mono">
                    {Object.values(e.sourceValues).map(fmt).join(" + ")}
                  </td>
                  <td>
                    <button className="text-link" onClick={() => onOpen(o)}>
                      Inspect
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rejected.length && (
          <Empty
            title="No held records match."
            description="Change the filters to inspect other errors."
          />
        )}
      </div>
      <Pager page={page} total={rejected.length} onChange={onPage} />
    </>
  );
}
