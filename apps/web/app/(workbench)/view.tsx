"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useWorkbench } from "@/components/workbench/context";
import { nextStage } from "@/components/workbench/lifecycle";
import { RecordMap } from "@/components/workbench/record-map";
import { Box, Empty, Mark, Sheet } from "@/components/workbench/ui";

export function Overview() {
  const wb = useWorkbench();
  const { state, plan, run, stages } = wb;
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
      <Sheet title="Dataset" id="dataset-heading">
        <div className="form-grid four">
          <Box label="Source">
            <code className="value-strong">legacy_crm.customers</code>
            <small>Old CRM export</small>
          </Box>
          <Box label="Target">
            <code className="value-strong">target.customers</code>
            <small>
              {state.target.length} rows ({preExisting} already there)
            </small>
          </Box>
          <Box label="Records">
            <span className="figure">
              {state.dataset.recordCount}
              <small> / {state.maxRecords.toLocaleString()}</small>
            </span>
            <small>To move · limit 1,000</small>
          </Box>
          <Box label="Plan">
            {plan ? (
              <>
                <span className="value-strong">
                  Version {state.plans[0]!.version}{" "}
                  <Mark
                    status={state.plans[0]!.approval ? "approved" : "draft"}
                  />
                </span>
                <small>
                  {state.plans.length === 1
                    ? "1 version"
                    : `${state.plans.length} versions`}
                </small>
              </>
            ) : (
              <>
                <span className="value-strong">None yet</span>
                <small>The AI planner creates one</small>
              </>
            )}
          </Box>
        </div>
      </Sheet>

      <div className="split overview-split">
        <Sheet
          title="Record status"
          id="record-status-heading"
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
          meta={
            <span>
              {stages.filter((s) => s.state === "done").length} of{" "}
              {stages.length} done
            </span>
          }
        >
          <ol className="routing">
            {stages.map((s) => (
              <li
                key={s.id}
                className={`route ${s.state} ${s.id === "decided" || s.id === "cleared" ? "human" : "machine"}`}
              >
                <span className="route-stamp" aria-hidden="true" />
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
    </>
  );
}
