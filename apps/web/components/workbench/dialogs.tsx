"use client";
import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { RunView } from "@manifest/db";
import type { RecordOutcome } from "@manifest/core";
import type { Act } from "../workbench-app";
import { useWorkbench } from "./context";
import { Dialog, Hash, Mark, fmt, words } from "./ui";

export function ApproveDialog({
  onClose,
  onDone,
  act,
}: {
  onClose: () => void;
  onDone: (notice: string) => void;
  act: Act;
}) {
  const { plan, dryForApproval, actor, busy } = useWorkbench();
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  if (!plan || !dryForApproval) return null;
  const high = plan.proposal.risks.filter((r) => r.severity === "high");
  const ready =
    !busy && !!actor.trim() && high.every((r) => acknowledged.includes(r.id));
  return (
    <Dialog title={`Approve plan version ${plan.version}`} onClose={onClose}>
      <p className="dialog-intro">
        Approval applies only to this exact version and its dry run. Any edit
        creates a new version that needs approval again.
      </p>
      <div className="form-grid two">
        <div className="box">
          <span className="box-label">Plan fingerprint</span>
          <div className="box-value">
            <Hash value={plan.specHash} />
          </div>
        </div>
        <div className="box">
          <span className="box-label">Dry run result</span>
          <div className="box-value mono">
            {dryForApproval.counts.accepted} accepted ·{" "}
            {dryForApproval.counts.rejected} held
          </div>
        </div>
      </div>
      <fieldset className="acknowledge">
        <legend>Confirm each high risk</legend>
        {high.map((r) => (
          <label className="check-row" key={r.id}>
            <input
              type="checkbox"
              checked={acknowledged.includes(r.id)}
              onChange={(e) =>
                setAcknowledged((a) =>
                  e.target.checked ? [...a, r.id] : a.filter((i) => i !== r.id),
                )
              }
            />
            <span>
              <strong>{r.title}</strong>
              <small>{r.explanation}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="signature-line">
        <span>Approved by</span>
        <strong>{actor.trim() || "Enter your name at the top"}</strong>
      </div>
      <button
        className="button clear full"
        disabled={!ready}
        onClick={() =>
          void act(
            "Approving",
            "approve",
            {
              planId: plan.id,
              dryRunId: dryForApproval.id,
              specHash: plan.specHash,
              approvedBy: actor,
              acknowledgedRisks: acknowledged,
            },
            () => {
              onClose();
              onDone("Plan approved. Load the data on Load & verify.");
            },
          )
        }
      >
        Approve this version
      </button>
    </Dialog>
  );
}

export function RollbackDialog({
  onClose,
  onDone,
  act,
}: {
  onClose: () => void;
  onDone: (notice: string) => void;
  act: Act;
}) {
  const { execution, state, actor, busy } = useWorkbench();
  const [reason, setReason] = useState("");
  if (!execution) return null;
  const owned = state.target.filter(
    (r) => r._migration_lineage_id === execution.lineageId,
  ).length;
  const preExisting = state.target.filter(
    (r) => r._migration_lineage_id === null,
  ).length;
  return (
    <Dialog title="Roll back this migration" onClose={onClose}>
      <p className="dialog-intro">
        This deletes only the rows this migration added. The {preExisting} rows
        that were already there stay. Rollback stops if a migrated row was
        edited after loading.
      </p>
      <div className="form-grid two">
        <div className="box">
          <span className="box-label">Rows to remove</span>
          <div className="box-value figure danger">{owned}</div>
        </div>
        <div className="box">
          <span className="box-label">Rows kept</span>
          <div className="box-value figure">{preExisting}</div>
        </div>
      </div>
      <label className="field">
        <span>Reason for rollback</span>
        <textarea
          aria-label="Reason for rollback"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Recorded in the activity log"
        />
      </label>
      <button
        className="button danger full"
        disabled={!!busy || !reason.trim() || !actor.trim()}
        onClick={() =>
          void act<{ rowsDeleted: number }>(
            "Rolling back migration",
            "rollback",
            { lineageId: execution.lineageId, requestedBy: actor, reason },
            (r) => {
              onClose();
              onDone(
                `Rollback complete. ${r.rowsDeleted} migrated rows removed.`,
              );
            },
          )
        }
      >
        Confirm rollback
      </button>
    </Dialog>
  );
}

export function EvidenceDialog({
  outcome,
  run,
  onClose,
}: {
  outcome: RecordOutcome;
  run: RunView;
  onClose: () => void;
}) {
  const errors = run.result.fieldErrors.filter(
    (e) => e.rowIndex === outcome.rowIndex,
  );
  const failing = new Set(errors.map((e) => e.targetField));
  return (
    <Dialog
      title={`Record ${outcome.recordKey || `row ${outcome.rowIndex + 1}`}`}
      onClose={onClose}
      wide
    >
      <div className="form-grid three">
        <div className="box">
          <span className="box-label">Status</span>
          <div className="box-value">
            <Mark
              status={outcome.status === "rejected" ? "held" : "accepted"}
            />
          </div>
        </div>
        <div className="box">
          <span className="box-label">Source row</span>
          <div className="box-value mono">{outcome.rowIndex + 1}</div>
        </div>
        <div className="box">
          <span className="box-label">Held at</span>
          <div className="box-value mono">
            {outcome.stage ? words(outcome.stage) : "—"}
          </div>
        </div>
      </div>
      <h3 className="dialog-heading">Field errors</h3>
      <div className="evidence-list">
        {errors.map((e, i) => (
          <article className="evidence" key={i}>
            <header>
              <code className="code-chip">{e.code}</code>
              <strong className="mono">{e.targetField}</strong>
              <small>
                {words(e.stage)}
                {e.op ? ` · step ${(e.stepIndex ?? 0) + 1} · ${e.op}` : ""}
              </small>
            </header>
            <p>{e.message}</p>
            <dl>
              {Object.entries(e.sourceValues).map(([field, value]) => (
                <div key={field}>
                  <dt className="mono">{field}</dt>
                  <dd className="mono">
                    {value === null ? "null" : JSON.stringify(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <h3 className="dialog-heading">Transformation steps</h3>
      <div className="trace-list">
        {outcome.trace.map((t) => (
          <details
            className="trace"
            key={t.targetField}
            open={failing.has(t.targetField)}
          >
            <summary>
              <code>{t.targetField}</code>
              {failing.has(t.targetField) ? (
                <Mark status="held" />
              ) : (
                <Mark status="accepted" label="ok" />
              )}
            </summary>
            <ol>
              {t.steps.map((step, index) => (
                <li key={index} className={step.ok ? "" : "failed"}>
                  <span className="step-op mono">{step.op}</span>
                  <span className="step-io mono">
                    {JSON.stringify(step.input)}
                  </span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span className="step-io mono">
                    {JSON.stringify(step.output)}
                  </span>
                  {step.ok ? (
                    <Check size={14} aria-label="passed" />
                  ) : (
                    <X size={14} aria-label="failed" />
                  )}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
      <h3 className="dialog-heading">Resulting target row</h3>
      <dl className="candidate-row">
        {Object.entries(outcome.row ?? {}).map(([field, value]) => (
          <div key={field} className={failing.has(field) ? "failed" : ""}>
            <dt className="mono">{field}</dt>
            <dd className="mono">{fmt(value)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
