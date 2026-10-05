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
      label: "Source ready",
      detail: `${state.dataset.recordCount} records`,
      state: "done",
      href: "/schemas",
      action: "View source data",
    },
    {
      id: "proposed",
      label: "Plan created",
      detail: running
        ? "AI planner working…"
        : plan
          ? `Version ${plan.version}`
          : "Not started",
      state: running ? "running" : plan ? "done" : "waiting",
      href: "/agent",
      action: "Create plan with AI",
    },
    {
      id: "decided",
      label: "Questions answered",
      detail: !plan
        ? "Waiting for a plan"
        : open
          ? `${open} still open`
          : "All answered",
      state: !plan ? "waiting" : open ? "attention" : "done",
      href: "/agent",
      action: "Answer questions",
    },
    {
      id: "inspected",
      label: "Dry run done",
      detail: dry
        ? `${dry.counts.accepted} accepted · ${dry.counts.rejected} held`
        : "Not run on the latest version",
      state: dry ? "done" : "waiting",
      href: dry ? `/runs/${dry.id}` : planHref,
      action: "Run dry run",
    },
    {
      id: "cleared",
      label: "Approved",
      detail: plan?.approval
        ? `Version ${plan.version} by ${plan.approval.approvedBy}`
        : approved
          ? `Only version ${approved.version} approved`
          : "Not approved",
      state: plan?.approval ? "done" : "waiting",
      href: planHref,
      action: "Review & approve",
    },
    {
      id: "landed",
      label: "Loaded",
      detail: live
        ? live.status === "failed"
          ? "Stopped · safe to retry"
          : live.status === "running"
            ? "Loading…"
            : `${live.insertedCount + live.skippedExisting} rows`
        : latestExecution
          ? "Undone by rollback"
          : "Not loaded",
      state: live
        ? live.status === "failed"
          ? "attention"
          : live.status === "running"
            ? "running"
            : "done"
        : "waiting",
      href: live ? `/runs/${live.id}` : "/target",
      action: live?.status === "failed" ? "Retry the load" : "Load the data",
    },
    {
      id: "reconciled",
      label: "Totals checked",
      detail: recon
        ? recon.status === "matched"
          ? "Totals match"
          : "Totals differ"
        : "Not checked",
      state: recon
        ? recon.status === "matched"
          ? "done"
          : "attention"
        : "waiting",
      href: "/target",
      action: "Check totals",
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
