"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { FieldError } from "@manifest/core";
import { useWorkbench } from "../context";
import { RecordMap } from "../record-map";
import { Box, Empty, Hash, Mark, Pager, Sheet, fmt, time, words } from "../ui";

export function Runs() {
  const wb = useWorkbench();
  const { state, run } = wb;
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [code, setCode] = useState("");

  const byRow = useMemo(() => {
    const map = new Map<number, FieldError[]>();
    for (const e of run?.result.fieldErrors ?? [])
      map.set(e.rowIndex, [...(map.get(e.rowIndex) ?? []), e]);
    return map;
  }, [run]);

  if (!run)
    return (
      <div className="sheet">
        <Empty
          title="Every dry run leaves a record."
          description="Draft a plan, enter your operator name and run a dry run. Accepted rows and quarantine evidence appear here."
        >
          <Link href="/plans" className="button primary">
            Review plans
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Empty>
      </div>
    );

  const { counts } = run.result;
  const codes = [...new Set(run.result.fieldErrors.map((e) => e.code))];
  const codeCounts = codes.map(
    (c) =>
      [
        c,
        new Set(
          run.result.fieldErrors
            .filter((e) => e.code === c)
            .map((e) => e.rowIndex),
        ).size,
      ] as const,
  );
  const held = run.result.outcomes.filter(
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
  const runPlan = state.plans.find((p) => p.id === run.planVersionId);
  const batches = Math.ceil(counts.accepted / 50);
  const previousDry = state.runs.find(
    (r) =>
      r.kind === "dry_run" &&
      r.id !== run.id &&
      r.planVersionId === run.planVersionId &&
      r.resultHash === run.result.resultHash,
  );

  return (
    <>
      <div className="run-bar">
        <label className="run-select">
          <span>Run</span>
          <select
            aria-label="Run history"
            value={run.id}
            onChange={(e) => wb.navigate(`/runs/${e.target.value}`)}
          >
            {state.runs.map((r) => {
              const v = state.plans.find(
                (p) => p.id === r.planVersionId,
              )?.version;
              return (
                <option key={r.id} value={r.id}>
                  {r.kind === "dry_run" ? "Dry run" : "Execution"} · v{v} ·{" "}
                  {time(r.startedAt)} · {words(r.status)}
                </option>
              );
            })}
          </select>
        </label>
        <Mark status={run.status} />
        <span className="mono run-attempt">
          {run.kind === "dry_run"
            ? "Dry run"
            : `Execution · attempt ${run.attempt}`}{" "}
          · plan v{runPlan?.version}
        </span>
      </div>

      <div className="form-grid four standalone tally">
        <Box n={1} label="Source">
          <span className="figure">{counts.source}</span>
          <small>Staged source records</small>
        </Box>
        <Box n={2} label="Transformed">
          <span className="figure">{counts.transformed}</span>
          <small>Every pipeline completed</small>
        </Box>
        <Box n={3} label="Accepted">
          <span className="figure">{counts.accepted}</span>
          <small>Cleared for the target</small>
        </Box>
        <Box n={4} label="Rejected · held">
          <span className="figure">{counts.rejected}</span>
          <small>Held in quarantine with evidence</small>
        </Box>
      </div>

      <div className="fingerprint">
        <span className="fingerprint-proof">
          <b>{counts.source}</b> source = <b>{counts.accepted}</b> accepted +{" "}
          <b>{counts.rejected}</b> held
        </span>
        <span className="fingerprint-note">
          {run.kind === "dry_run"
            ? previousDry
              ? "Deterministic: identical to an earlier dry run of this version."
              : "Deterministic: the same plan and data always produce this fingerprint."
            : "Execution reuses the approved dry-run result."}
        </span>
        <Hash value={run.result.resultHash} label="Result" />
      </div>

      {run.kind === "execution" && (
        <Sheet
          title="Load"
          id="load-heading"
          meta={
            <span className="mono">
              batches of 50 · lineage {run.lineageId.slice(0, 8)}
            </span>
          }
        >
          <div className="load">
            <ol
              className="batches"
              aria-label={`${run.batchesCommitted} of ${batches} batches committed`}
            >
              {Array.from({ length: batches }, (_, i) => (
                <li
                  key={i}
                  className={
                    i < run.batchesCommitted
                      ? "committed"
                      : run.status === "failed" && i === run.batchesCommitted
                        ? "failed"
                        : "pending"
                  }
                >
                  <span className="mono">{i + 1}</span>
                </li>
              ))}
            </ol>
            <div className="form-grid three execution-summary">
              <div className="box" data-testid="inserted">
                <span className="box-label">Inserted this attempt</span>
                <strong className="box-value figure">
                  {run.insertedCount}
                </strong>
              </div>
              <div className="box" data-testid="skipped-existing">
                <span className="box-label">Already loaded · skipped</span>
                <strong className="box-value figure">
                  {run.skippedExisting}
                </strong>
              </div>
              <div className="box">
                <span className="box-label">Committed batches</span>
                <strong className="box-value figure">
                  {run.batchesCommitted}
                  <small> / {batches}</small>
                </strong>
              </div>
            </div>
            <p
              className={`load-note ${run.status === "failed" ? "failed" : ""}`}
            >
              {run.error ??
                (run.skippedExisting
                  ? `${run.skippedExisting} rows were offered again and refused by the unique legacy_id key. No duplicates.`
                  : "Every landed row carries this migration's lineage and its expected content hash.")}
            </p>
            {run.status === "failed" && runPlan && (
              <button
                className="button primary"
                disabled={!!wb.busy || !wb.actor.trim()}
                onClick={() => wb.retry(runPlan.id)}
              >
                Retry migration safely
              </button>
            )}
          </div>
        </Sheet>
      )}

      <Sheet
        title="Consignment"
        id="run-map-heading"
        meta={<span>Each cell is one source record</span>}
      >
        <div className="sheet-body">
          <RecordMap
            total={counts.source}
            recordKeys={state.dataset.records.map((r) =>
              String(r.payload.cust_id ?? ""),
            )}
            outcomes={run.result.outcomes}
            fieldErrors={run.result.fieldErrors}
            landedKeys={run.kind === "execution" ? wb.landedKeys : undefined}
            sweepKey={run.id}
            onOpen={wb.openEvidence}
          />
        </div>
      </Sheet>

      <Sheet
        title="Quarantine manifest"
        id="quarantine-heading"
        meta={<Mark status="held" label={`${counts.rejected} held`} />}
      >
        <div
          className="quarantine-codes"
          role="group"
          aria-label="Filter by error code"
        >
          <button
            type="button"
            className={`code-filter ${code === "" ? "active" : ""}`}
            aria-pressed={code === ""}
            onClick={() => {
              setCode("");
              setPage(0);
            }}
          >
            All <b>{counts.rejected}</b>
          </button>
          {codeCounts.map(([c, n]) => (
            <button
              type="button"
              key={c}
              className={`code-filter ${code === c ? "active" : ""}`}
              aria-pressed={code === c}
              onClick={() => {
                setCode(code === c ? "" : c);
                setPage(0);
              }}
            >
              {c} <b>{n}</b>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={15} aria-hidden="true" />
            <input
              placeholder="Search record key, field or code"
              aria-label="Search quarantine"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="ledger-table quarantine">
            <thead>
              <tr>
                <th scope="col">Row</th>
                <th scope="col">Record key</th>
                <th scope="col">Field</th>
                <th scope="col">Error code</th>
                <th scope="col">Original value</th>
                <th scope="col">
                  <span className="sr-only">Evidence</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {held.slice(page * 15, (page + 1) * 15).map((o) => {
                const errs = byRow.get(o.rowIndex) ?? [];
                const e = errs.find((x) => !code || x.code === code)!;
                return (
                  <tr key={o.rowIndex}>
                    <td className="row-no">{o.rowIndex + 1}</td>
                    <td className="mono">{o.recordKey || "(blank)"}</td>
                    <td className="mono">
                      {e.targetField}
                      {errs.length > 1 && (
                        <span className="more">+{errs.length - 1}</span>
                      )}
                    </td>
                    <td>
                      <span className="code-chip">{e.code}</span>
                    </td>
                    <td className="mono original">
                      {Object.values(e.sourceValues).map(fmt).join(" + ")}
                    </td>
                    <td className="action">
                      <button
                        className="text-link"
                        onClick={() => wb.openEvidence(o)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!held.length && (
            <Empty
              title="No held records match."
              description="Clear the search or choose another error code."
            />
          )}
        </div>
        <Pager
          page={page}
          total={held.length}
          onChange={setPage}
          noun="held records"
        />
      </Sheet>

      {run.kind === "dry_run" && (
        <div className="closing-band">
          <div>
            <strong>The mock target is untouched.</strong>
            <span>
              Review the evidence, then sign this plan version to enable
              execution.
            </span>
          </div>
          <Link
            className="button secondary"
            href={`/plans/${run.planVersionId}`}
          >
            Review this plan
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </>
  );
}
