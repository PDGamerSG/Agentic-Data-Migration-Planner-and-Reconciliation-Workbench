import type { WorkbenchState } from "@manifest/db";

export type Plan = WorkbenchState["plans"][number];
export type RunSummary = WorkbenchState["runs"][number];
export type StageState =
  "done" | "current" | "waiting" | "attention" | "running";
export type Stage = {
  id:
    | "staged"
    | "proposed"
    | "decided"
    | "inspected"
    | "cleared"
    | "landed"
    | "reconciled";
  label: string;
  detail: string;
  state: StageState;
  href: string;
  action: string;
};

/** Open blocking questions on a plan version. */
export const openDecisions = (plan: Plan | undefined) =>
  plan?.proposal.questions.filter((q) => q.blocking && !plan.answers[q.id])
    .length ?? 0;

/** The latest execution that has not been rolled back. */
export const liveExecution = (state: WorkbenchState) =>
  state.runs.find((r) => r.kind === "execution" && r.status !== "rolled_back");

/**
 * Derives where the declaration stands, step by step, from persisted state only.
 * The first unfinished step becomes "current" so the UI can always name the next action.
 */
export function lifecycle(state: WorkbenchState): Stage[] {
  const plan = state.plans[0];
  const running = state.sessions.some((s) => s.status === "running");
  const open = openDecisions(plan);
  const dry = plan
    ? state.runs.find(
        (r) =>
          r.kind === "dry_run" &&
          r.planVersionId === plan.id &&
          r.status === "succeeded",
      )
    : undefined;
  const approved = state.plans.find((p) => p.approval);
  const live = liveExecution(state);
  const latestExecution = state.runs.find((r) => r.kind === "execution");
  const recon = live
    ? state.reconciliations.find((r) => r.lineageId === live.lineageId)
    : undefined;
  const planHref = plan ? `/plans/${plan.id}` : "/plans";

  const stages: Stage[] = [
    {
      id: "staged",
      label: "Staged",
      detail: `${state.dataset.recordCount} of ${state.maxRecords} records`,
      state: "done",
      href: "/schemas",
      action: "Inspect source",
    },
    {
      id: "proposed",
      label: "Proposed",
      detail: running
        ? "Planner inspecting…"
        : plan
          ? `v${plan.version} · ${plan.authorName}`
          : "No proposal yet",
      state: running ? "running" : plan ? "done" : "waiting",
      href: "/agent",
      action: "Draft migration plan",
    },
    {
      id: "decided",
      label: "Decided",
      detail: !plan
        ? "Awaiting proposal"
        : open
          ? `${open} decisions open`
          : "All decisions recorded",
      state: !plan ? "waiting" : open ? "attention" : "done",
      href: "/agent",
      action: "Answer decisions",
    },
    {
      id: "inspected",
      label: "Inspected",
      detail: dry
        ? `${dry.counts.accepted} accepted · ${dry.counts.rejected} held`
        : "No dry run on latest version",
      state: dry ? "done" : "waiting",
      href: dry ? `/runs/${dry.id}` : planHref,
      action: "Run dry run",
    },
    {
      id: "cleared",
      label: "Cleared",
      detail: plan?.approval
        ? `v${plan.version} signed by ${plan.approval.approvedBy}`
        : approved
          ? `v${approved.version} cleared · v${plan?.version} draft`
          : "Awaiting signature",
      state: plan?.approval ? "done" : "waiting",
      href: planHref,
      action: "Review & approve",
    },
    {
      id: "landed",
      label: "Landed",
      detail: live
        ? live.status === "failed"
          ? "Interrupted · retry is safe"
          : live.status === "running"
            ? "Loading batches…"
            : `${live.insertedCount + live.skippedExisting} rows · attempt ${live.attempt}`
        : latestExecution
          ? "Recalled by rollback"
          : "Nothing loaded",
      state: live
        ? live.status === "failed"
          ? "attention"
          : live.status === "running"
            ? "running"
            : "done"
        : "waiting",
      href: live ? `/runs/${live.id}` : "/target",
      action:
        live?.status === "failed" ? "Retry migration" : "Execute migration",
    },
    {
      id: "reconciled",
      label: "Reconciled",
      detail: recon
        ? recon.status === "matched"
          ? "Totals match"
          : "Totals differ"
        : "Not reconciled",
      state: recon
        ? recon.status === "matched"
          ? "done"
          : "attention"
        : "waiting",
      href: "/target",
      action: "Reconcile totals",
    },
  ];

  const first = stages.find((s) => s.state !== "done");
  if (first?.state === "waiting") first.state = "current";
  return stages;
}

/** The step a visitor should take next, or null when the whole declaration is complete. */
export const nextStage = (stages: Stage[]) =>
  stages.find(
    (s) =>
      s.state === "current" || s.state === "attention" || s.state === "running",
  ) ?? null;
