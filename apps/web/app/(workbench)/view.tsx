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
      <Sheet
        title="Dataset"
        id="dataset-heading"
        meta={<span className="mono">Declaration MIG-0001</span>}
      >
        <div className="form-grid five">
          <Box n={1} label="Consignor · source">
            <code className="value-strong">legacy_crm.customers</code>
            <small>
              Legacy CRM export · {state.sourceSchema.fields.length} text fields
            </small>
          </Box>
          <Box n={2} label="Consignee · target">
            <code className="value-strong">target.customers</code>
            <small>
              Customer registry · {state.target.length} rows ({preExisting}{" "}
              pre-existing)
            </small>
          </Box>
          <Box n={3} label="Packages">
            <span className="figure">
              {state.dataset.recordCount}
              <small> / {state.maxRecords.toLocaleString()}</small>
            </span>
            <small>Records staged · documented maximum</small>
          </Box>
          <Box n={4} label="Declared plan">
            {plan ? (
              <>
                <span className="value-strong">
                  Version {state.plans[0]!.version}{" "}
                  <Mark
                    status={state.plans[0]!.approval ? "approved" : "draft"}
                  />
                </span>
                <small>{state.plans.length} immutable versions on file</small>
              </>
            ) : (
              <>
                <span className="value-strong">None yet</span>
                <small>The planning agent drafts version 1</small>
              </>
            )}
          </Box>
          <Box n={5} label="Planner">
            <span className="value-strong">
              {state.provider === "groq" ? "Groq" : "Offline planner"}
            </span>
            <small>
              {state.provider === "groq"
                ? "gpt-oss-120b · read-only tools"
                : "Deterministic · same tools"}
            </small>
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
              <span>Awaiting dry run</span>
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
                  <p className="tally-line readout-hint">
                    Each square is one source record. Select a hatched record to
                    inspect why it was held.
                  </p>
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
              title={`${state.dataset.recordCount} records waiting for inspection`}
              description={
                !latestPlan
                  ? "Draft a migration plan, then run a dry run to check these records without changing the target."
                  : wb.openQuestions
                    ? `Version ${latestPlan.version} needs its own dry run. Answer the open business decisions before inspecting these records.`
                    : `Version ${latestPlan.version} needs its own dry run. Review the plan and run a check to see which records are accepted or held. The target will not change.`
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
                  ? "Open planning agent"
                  : wb.openQuestions
                    ? "Answer decisions"
                    : "Review plan"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/schemas" className="text-link">
                Browse source records
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </Empty>
          )}
        </Sheet>

        <Sheet
          title="Routing slip"
          id="routing-heading"
          meta={
            <span>
              {stages.filter((s) => s.state === "done").length} / 7 stamped
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
          <div className="routing-next">
            {next ? (
              <>
                {next.id === "proposed" ? (
                  <button
                    className="button primary full"
                    onClick={wb.draft}
                    disabled={!!wb.busy || wb.runningSession}
                  >
                    {wb.runningSession
                      ? "Planner running…"
                      : "Start the planning agent"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <Link href={next.href} className="button primary full">
                    {next.action}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </>
            ) : (
              <p>
                Every stage is stamped. The load is reconciled; recall it from
                the target ledger if needed.
              </p>
            )}
          </div>
        </Sheet>
      </div>
    </>
  );
}
