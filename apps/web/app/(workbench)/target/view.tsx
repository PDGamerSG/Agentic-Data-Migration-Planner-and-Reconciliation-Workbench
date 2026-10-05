"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { useWorkbench } from "@/components/workbench/context";
import {
  Empty,
  Mark,
  Pager,
  Sheet,
  fmt,
  time,
} from "@/components/workbench/ui";

export function Target() {
  const wb = useWorkbench();
  const { state, plan, execution, reconciliation } = wb;
  const [page, setPage] = useState(0);
  const preExisting = state.target.filter(
    (r) => r._migration_lineage_id === null,
  ).length;
  const owned = state.target.length - preExisting;
  const report = reconciliation?.report;
  return (
    <>
      <section className="destination" aria-labelledby="destination-heading">
        <div>
          <h2 id="destination-heading">
            {state.target.length} rows in the target table
          </h2>
          <p>
            <span className="mono">target.customers</span> · {preExisting}{" "}
            already there · {owned} added by this migration
          </p>
        </div>
        <div className="destination-bar" aria-hidden="true">
          <span className="pre" style={{ flex: preExisting }} />
          {owned > 0 && <span className="owned" style={{ flex: owned }} />}
        </div>
      </section>

      <div className="split target-split">
        <Sheet
          title="Totals check"
          id="ledger-heading"
          meta={reconciliation && <Mark status={reconciliation.status} />}
        >
          {!report ? (
            <Empty
              title="Not checked yet"
              description="After loading, compare source and target totals here."
            />
          ) : (
            <>
              <table className="ledger-table reconcile">
                <thead>
                  <tr>
                    <th scope="col">Check</th>
                    <th scope="col" className="num">
                      Expected
                    </th>
                    <th scope="col" className="num">
                      Actual
                    </th>
                    <th scope="col">
                      <span className="sr-only">Result</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.checks.map((c) => (
                    <tr key={c.label} className={c.matched ? "" : "off"}>
                      <td>{c.label}</td>
                      <td className="num mono">
                        {c.expected.toLocaleString()}
                      </td>
                      <td className="num mono">{c.actual.toLocaleString()}</td>
                      <td className="verdict">
                        {c.matched ? (
                          <Check size={16} aria-label="matches" />
                        ) : (
                          <X size={16} aria-label="differs" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sheet-foot">
                <span>
                  {report.missing.length} missing keys ·{" "}
                  {report.unexpected.length} unexpected keys ·{" "}
                  {report.mismatches.length} content mismatches
                </span>
                <span className="mono">
                  {time(reconciliation!.createdAt)}
                  {report.rolledBack ? " · after rollback" : ""}
                </span>
              </p>
            </>
          )}
        </Sheet>

        <Sheet title="Load data" id="controls-heading">
          <div className="controls">
            <label className="field">
              <span>Plan version</span>
              <select
                aria-label="Execution plan"
                value={plan?.id ?? ""}
                onChange={(e) => wb.choosePlan(e.target.value)}
              >
                {!state.plans.length && <option value="">No plan yet</option>}
                {state.plans.map((p) => (
                  <option value={p.id} key={p.id}>
                    Version {p.version} · {p.approval ? "approved" : "draft"}
                  </option>
                ))}
              </select>
            </label>
            <p className="controls-note">
              {plan?.approval
                ? `Version ${plan.version} is approved by ${plan.approval.approvedBy}.`
                : "Approve this plan version before loading."}
            </p>
            {state.faultInjection && (
              <label className="check-row compact">
                <input
                  type="checkbox"
                  checked={wb.fault}
                  onChange={(e) => wb.setFault(e.target.checked)}
                />
                <span>
                  <strong>Simulate interruption after batch 3</strong>
                  <small>
                    Stops the load part way so you can test a safe retry.
                  </small>
                </span>
              </label>
            )}
            <button
              className="button primary full"
              onClick={wb.execute}
              disabled={!!wb.busy || !wb.actor.trim() || !plan?.approval}
            >
              {execution?.status === "failed"
                ? "Retry the load"
                : "Load approved records"}
            </button>
            {execution && (
              <div className="controls-secondary">
                <button
                  className="button secondary full"
                  disabled={!!wb.busy || !wb.actor.trim()}
                  onClick={wb.reconcile}
                >
                  Check totals
                </button>
                <button
                  className="button danger full"
                  disabled={
                    !!wb.busy ||
                    !wb.actor.trim() ||
                    execution.status === "running"
                  }
                  onClick={wb.openRollback}
                >
                  Roll back migration
                </button>
              </div>
            )}
            <p className="controls-note small">
              Rollback removes only rows this migration added.
            </p>
          </div>
        </Sheet>
      </div>

      <Sheet
        title="Target table"
        id="registry-heading"
        meta={<span>Read-only</span>}
      >
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th scope="col">Origin</th>
                <th scope="col">Legacy ID</th>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Country</th>
                <th scope="col" className="num">
                  Credit limit
                </th>
                <th scope="col">Consent</th>
              </tr>
            </thead>
            <tbody>
              {state.target.slice(page * 15, (page + 1) * 15).map((r) => (
                <tr
                  key={r.id}
                  className={r._migration_lineage_id ? "landed-row" : ""}
                >
                  <td>
                    <Mark
                      status={
                        r._migration_lineage_id ? "landed" : "pre-existing"
                      }
                      label={r._migration_lineage_id ? "migrated" : "existing"}
                    />
                  </td>
                  <td className="mono">{fmt(r.legacy_id)}</td>
                  <td>
                    {fmt(r.first_name)} {r.last_name}
                  </td>
                  <td className="mono">{r.email}</td>
                  <td>{r.status}</td>
                  <td className="mono">{r.country_code}</td>
                  <td className="num mono">
                    {(Number(r.credit_limit_cents) / 100).toFixed(2)}
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
          noun="rows"
        />
      </Sheet>
    </>
  );
}
