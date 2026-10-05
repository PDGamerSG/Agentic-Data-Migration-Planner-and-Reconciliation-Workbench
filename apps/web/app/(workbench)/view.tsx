"use client";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Database,
  FileJson2,
  GitBranch,
  Circle,
  ArrowUpRight,
} from "lucide-react";
import { useWorkbench } from "@/components/workbench/context";
import { nextStage } from "@/components/workbench/lifecycle";
import { RecordMap } from "@/components/workbench/record-map";
import { Empty, Mark, Sheet, time } from "@/components/workbench/ui";

export function Overview() {
  const wb = useWorkbench();
  const { state, run, stages } = wb;
  const preExisting = state.target.filter(
    (r) => r._migration_lineage_id === null,
  ).length;
  const next = nextStage(stages);
  const latestPlan = state.plans[0];
  const latestDry = state.runs.find(
    (r) =>
      r.planVersionId === latestPlan?.id &&
      r.kind === "dry_run" &&
      r.status === "succeeded",
  );
  const inspection =
    latestDry &&
    run?.id === latestDry.id &&
    run.planVersionId === latestPlan?.id &&
    run.kind === "dry_run" &&
    run.status === "succeeded"
      ? run
      : null;
  const counts = latestDry?.counts;
  return (
    <>
      <Sheet
        title="Migration path"
        id="dataset-heading"
        className="migration-path"
        meta={<span className="scope-label">One source → one target</span>}
      >
        <div className="connection-flow">
          <Link href="/schemas" className="connection-endpoint">
            <span className="endpoint-icon">
              <FileJson2 size={23} aria-hidden="true" />
            </span>
            <div>
              <span className="endpoint-label">Source dataset</span>
              <code>legacy_crm.customers</code>
              <p>
                Legacy CRM export <span>·</span> {state.dataset.recordCount}{" "}
                records
              </p>
            </div>
            <ArrowUpRight
              size={17}
              className="endpoint-link"
              aria-hidden="true"
            />
          </Link>
          <div className="connection-bridge" aria-hidden="true">
            <span />
            <ArrowRight size={18} />
            <span />
          </div>
          <Link href="/target" className="connection-endpoint">
            <span className="endpoint-icon target">
              <Database size={23} aria-hidden="true" />
            </span>
            <div>
              <span className="endpoint-label">Target registry</span>
              <code>target.customers</code>
              <p>
                {state.target.length} rows <span>·</span> {preExisting}{" "}
                pre-existing
              </p>
            </div>
            <ArrowUpRight
              size={17}
              className="endpoint-link"
              aria-hidden="true"
            />
          </Link>
        </div>
        <div className="migration-facts">
          <span>
            <Circle size={13} aria-hidden="true" />
            Record limit{" "}
            <strong>
              {state.dataset.recordCount} / {state.maxRecords.toLocaleString()}
            </strong>
          </span>
          <span>
            <GitBranch size={14} aria-hidden="true" />
            Latest plan{" "}
            <strong>
              {latestPlan ? `Version ${latestPlan.version}` : "None yet"}
            </strong>
            {latestPlan && (
              <Mark status={latestPlan.approval ? "approved" : "draft"} />
            )}
          </span>
          <Link href="/tests" className="text-link">
            Browse tests <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </Sheet>

      <div className="split overview-split">
        <Sheet
          title="Record status"
          id="record-status-heading"
          className="overview-records"
          meta={
            latestDry ? (
              <Link href={`/runs/${latestDry.id}`} className="text-link">
                Open dry run <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : (
              <span>No dry run yet</span>
            )
          }
        >
          {counts ? (
            <div className="sheet-body">
              {counts && (
                <p className="tally-line">
                  <span>
                    <b>{counts.source}</b> source
                  </span>
                  <span aria-hidden="true">→</span>
                  <span>
                    <b>{counts.transformed}</b> transformed
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="ok">
                    <b>{counts.accepted}</b> accepted
                  </span>
                  <span aria-hidden="true">+</span>
                  <span className="held">
                    <b>{counts.rejected}</b> held
                  </span>
                </p>
              )}
              {inspection ? (
                <>
                  <RecordMap
                    total={counts.source}
                    recordKeys={state.dataset.records.map((r) =>
                      String(r.payload.cust_id ?? ""),
                    )}
                    outcomes={inspection.result.outcomes}
                    fieldErrors={inspection.result.fieldErrors}
                    landedKeys={wb.landedKeys}
                    sweepKey={inspection.id}
                    onOpen={wb.openEvidence}
                  />
                </>
              ) : (
                <p className="readout-hint" role="status">
                  {wb.runError
                    ? "Record details could not be loaded. Open the dry run to try again."
                    : "Loading record details…"}
                </p>
              )}
            </div>
          ) : (
            <Empty
              title={`${state.dataset.recordCount} records not tested yet`}
              description={
                !latestPlan
                  ? "Create a plan with the AI planner first."
                  : wb.openQuestions
                    ? "Answer the AI planner's questions first."
                    : `Run a dry run of version ${latestPlan.version} to test them. Nothing is written.`
              }
            >
              <Link
                href={
                  !latestPlan || wb.openQuestions
                    ? "/agent"
                    : `/plans/${latestPlan.id}`
                }
                className="button secondary"
              >
                {!latestPlan
                  ? "Open AI planner"
                  : wb.openQuestions
                    ? "Answer questions"
                    : "Open plan"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/schemas" className="text-link">
                View source data
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </Empty>
          )}
        </Sheet>

        <Sheet
          title="Steps"
          id="routing-heading"
          className="overview-steps"
          meta={
            <span>
              {stages.filter((s) => s.state === "done").length} of{" "}
              {stages.length} done
            </span>
          }
        >
          <ol className="routing">
            {stages.map((s, index) => (
              <li
                key={s.id}
                className={`route ${s.state} ${s.id === "decided" || s.id === "cleared" ? "human" : "machine"}`}
              >
                <span className="route-stamp" aria-hidden="true">
                  {s.state === "done" ? <Check size={14} /> : index + 1}
                </span>
                <div>
                  <strong>{s.label}</strong>
                  <span>{s.detail}</span>
                </div>
                <span className="sr-only">
                  {s.state === "done" ? "complete" : s.state}
                </span>
              </li>
            ))}
          </ol>
          {!next && (
            <p className="routing-next">
              All steps done. To undo the load, use Load &amp; verify.
            </p>
          )}
        </Sheet>
      </div>
      <Sheet
        title="Recent activity"
        id="recent-activity-heading"
        className="overview-activity"
        meta={
          <Link href="/history" className="text-link">
            View activity log <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        {state.runs.length ? (
          <ul className="recent-runs">
            {state.runs.slice(0, 3).map((r) => (
              <li key={r.id}>
                <span className="recent-run-icon">
                  <GitBranch size={17} aria-hidden="true" />
                </span>
                <div>
                  <Link href={`/runs/${r.id}`}>
                    {r.kind === "dry_run" ? "Dry run" : "Migration load"}{" "}
                    <span>
                      · Version{" "}
                      {state.plans.find((p) => p.id === r.planVersionId)
                        ?.version ?? "—"}
                    </span>
                  </Link>
                  <p>
                    {r.startedBy} · {r.counts.accepted} accepted ·{" "}
                    {r.counts.rejected} held
                  </p>
                </div>
                <Mark status={r.status} />
                <time dateTime={String(r.startedAt)}>{time(r.startedAt)}</time>
                <Link
                  href={`/runs/${r.id}`}
                  className="icon-button"
                  aria-label={`Open ${r.kind === "dry_run" ? "dry run" : "load"} ${r.id}`}
                >
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="activity-placeholder">
            <HistoryIcon />
            <div>
              <strong>Your migration history starts here</strong>
              <p>Dry runs, approvals and loads will appear as you work.</p>
            </div>
            <Link href="/schemas" className="text-link">
              Explore source data <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        )}
      </Sheet>
    </>
  );
}

function HistoryIcon() {
  return (
    <span className="recent-run-icon">
      <GitBranch size={18} aria-hidden="true" />
    </span>
  );
}
