"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { PlanSpec } from "@manifest/core";
import { CATALOG } from "@manifest/core/transforms";
import { MappingEditor } from "../../mapping-editor";
import { useWorkbench } from "../context";
import { Empty, Hash, Mark, Sheet, time } from "../ui";

function stepLabel(s: PlanSpec["mappings"][number]["steps"][number]) {
  return `${s.op}${"part" in s ? `:${s.part}` : "value" in s ? `:${String(s.value)}` : ""}`;
}

export function Plans() {
  const wb = useWorkbench();
  const { state, plan } = wb;
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState("");
  const [summary, setSummary] = useState("");
  useEffect(() => {
    if (plan) setEditor(JSON.stringify(plan.spec, null, 2));
    setEditing(false);
    setSummary("");
  }, [plan?.id]);

  if (!plan)
    return (
      <div className="sheet">
        <Empty
          title="No plan on file."
          description="Start the planning agent to draft version 1. Every later edit becomes a new immutable version."
        >
          <button
            className="button primary"
            onClick={wb.draft}
            disabled={!!wb.busy || wb.runningSession}
          >
            Draft migration plan
          </button>
        </Empty>
      </div>
    );

  const parsed = (() => {
    try {
      return JSON.parse(editor) as PlanSpec;
    } catch {
      return plan.spec;
    }
  })();
  const changes = plan.diff
    ? [
        ...plan.diff.changedMappings,
        ...plan.diff.addedMappings.map((f) => `added ${f}`),
        ...plan.diff.removedMappings.map((f) => `removed ${f}`),
        ...plan.diff.changedSettings,
      ]
    : null;
  const approvedElsewhere = state.plans.find(
    (p) => p.approval && p.id !== plan.id,
  );
  const versionStatus = (p: typeof plan) =>
    p.approval
      ? "approved"
      : approvedElsewhere && p.version < approvedElsewhere.version
        ? "superseded"
        : "draft";

  return (
    <>
      <nav className="copies" aria-label="Plan versions">
        {state.plans.map((p) => (
          <Link
            key={p.id}
            href={`/plans/${p.id}`}
            className={`copy ${p.id === plan.id ? "active" : ""} ${versionStatus(p)}`}
            aria-current={p.id === plan.id ? "page" : undefined}
          >
            <span className="copy-version mono">v{p.version}</span>
            <span className="copy-meta">{p.authorName}</span>
            <span className="copy-meta">{time(p.createdAt)}</span>
            <Mark status={versionStatus(p)} />
          </Link>
        ))}
      </nav>

      <div className="version-bar">
        <span className="version-name mono">Version {plan.version}</span>
        <span className="version-summary">{plan.changeSummary}</span>
        <Hash value={plan.specHash} label="Plan" />
      </div>
      {changes && (
        <p className="diff-line">
          <b>Changed from parent:</b>{" "}
          {changes.length
            ? changes.join(", ")
            : "mappings unchanged; decisions updated."}
        </p>
      )}

      <Sheet
        title="Field mapping manifest"
        id="mapping-heading"
        meta={
          <button
            className="button secondary small"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close editor" : "Edit as new version"}
          </button>
        }
      >
        {editing ? (
          <div className="plan-editor">
            <p className="editor-intro">
              Pick sources and transforms from the closed catalog only. Saving
              validates the whole plan and files a new draft; this version stays
              unchanged.
            </p>
            <div className="catalog" aria-label="Supported transformations">
              {Object.keys(CATALOG).map((op) => (
                <code key={op}>{op}</code>
              ))}
            </div>
            <MappingEditor
              spec={parsed}
              sourceFields={state.sourceSchema.fields.map((f) => f.name)}
              onChange={(s) => setEditor(JSON.stringify(s, null, 2))}
            />
            <details className="advanced">
              <summary>Advanced: edit the JSON specification</summary>
              <textarea
                aria-label="Plan specification"
                spellCheck={false}
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
                rows={22}
              />
            </details>
            <div className="editor-save">
              <label className="field">
                <span>Change summary</span>
                <input
                  aria-label="Change summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="What changed and why"
                  maxLength={500}
                />
              </label>
              <button
                className="button primary"
                disabled={!!wb.busy || !wb.actor.trim() || !summary.trim()}
                onClick={() => {
                  let spec: PlanSpec;
                  try {
                    spec = JSON.parse(editor) as PlanSpec;
                  } catch {
                    wb.fail("The plan specification must be valid JSON.");
                    return;
                  }
                  wb.savePlan(spec, summary);
                }}
              >
                Save new version
              </button>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="ledger-table mapping">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Source</th>
                  <th scope="col">Target</th>
                  <th scope="col">Transformation pipeline</th>
                  <th scope="col" className="num">
                    Measured
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.spec.mappings.map((m, i) => {
                  const measured = plan.proposal.measured[m.targetField];
                  const rate = measured
                    ? Math.round(measured.successRate * 100)
                    : null;
                  return (
                    <tr key={m.targetField}>
                      <td className="row-no">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td>
                        <code className={m.sources.length ? "" : "muted"}>
                          {m.sources.join(" + ") || "constant"}
                        </code>
                      </td>
                      <td>
                        <code className="value-strong">{m.targetField}</code>
                      </td>
                      <td>
                        <ol className="pipeline">
                          {m.steps.map((s, index) => (
                            <li key={index}>
                              <code>{stepLabel(s)}</code>
                              {index < m.steps.length - 1 && (
                                <ChevronRight size={12} aria-hidden="true" />
                              )}
                            </li>
                          ))}
                        </ol>
                      </td>
                      <td className="num">
                        {rate === null ? (
                          <span className="muted">re-test</span>
                        ) : (
                          <span
                            className={`measure ${rate === 100 ? "full" : "partial"}`}
                          >
                            <span
                              className="measure-bar"
                              style={
                                { "--w": rate / 100 } as React.CSSProperties
                              }
                              aria-hidden="true"
                            />
                            <span className="mono">{rate}%</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="sheet-foot">
          <span>
            {plan.spec.mappings.length} target fields mapped ·{" "}
            {plan.spec.unmappedSourceFields.length} source fields dropped on
            purpose
          </span>
          <span className="mono">As of {plan.spec.asOfDate}</span>
        </div>
      </Sheet>

      <Sheet
        title="Risks"
        id="risks-heading"
        meta={
          <span>
            {plan.proposal.risks.filter((r) => r.severity === "high").length}{" "}
            need acknowledgement
          </span>
        }
      >
        <ul className="risk-list">
          {plan.proposal.risks.map((r) => (
            <li key={r.id} className={`risk ${r.severity}`}>
              <span className="risk-level">{r.severity}</span>
              <div>
                <strong>{r.title}</strong>
                <p>{r.explanation}</p>
                {r.affectedFields.length > 0 && (
                  <span className="risk-fields mono">
                    {r.affectedFields.join(" · ")}
                    {r.estimatedRecords !== null &&
                      ` · ~${r.estimatedRecords} records`}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Sheet>

      <section
        className={`clearance ${plan.approval ? "signed" : ""}`}
        aria-labelledby="clearance-heading"
      >
        <div className="clearance-text">
          <h2 id="clearance-heading">Clearance</h2>
          {plan.approval ? (
            <>
              <p className="clearance-signed">
                Approved by {plan.approval.approvedBy}
              </p>
              <p>
                The signature is bound to this version and its dry run.
                Execution is available in the target ledger.
              </p>
            </>
          ) : (
            <p>
              {wb.openQuestions
                ? `${wb.openQuestions} business decisions are still open. Answer them in the planning agent, then re-draft.`
                : !wb.dryForApproval
                  ? "Run a dry run of this exact version before it can be signed."
                  : "Review the dry-run evidence, acknowledge the high risks, and sign this exact version."}
            </p>
          )}
        </div>
        {plan.approval ? (
          <div className="stamp-impression" key={plan.approval.id}>
            <span className="stamp-word">Cleared</span>
            <span className="stamp-line">
              v{plan.version} · {plan.approval.approvedBy}
            </span>
            <span className="stamp-line">{time(plan.approval.createdAt)}</span>
            <span className="stamp-line mono">
              {plan.specHash.slice(0, 12)}
            </span>
          </div>
        ) : (
          <button
            className="button clear"
            disabled={!wb.canApprove || !!wb.busy || !wb.actor.trim()}
            onClick={wb.openApprove}
          >
            Review & approve
          </button>
        )}
      </section>
    </>
  );
}
