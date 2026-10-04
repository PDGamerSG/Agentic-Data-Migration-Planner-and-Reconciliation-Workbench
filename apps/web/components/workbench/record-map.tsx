"use client";
import { useMemo, useState } from "react";
import type { FieldError, RecordOutcome } from "@manifest/core";

type CellState = "pending" | "accepted" | "held" | "landed";
type Cell = {
  rowIndex: number;
  recordKey: string;
  state: CellState;
  reason?: string;
  outcome?: RecordOutcome;
};

const LABEL: Record<CellState, string> = {
  pending: "not inspected",
  accepted: "accepted",
  held: "held in quarantine",
  landed: "landed in target",
};

/**
 * One cell per source record. Accepted cells are solid, held cells are hatched,
 * landed cells carry a ring, and uninspected cells are dashed outlines.
 * Held cells open their evidence; the readout names whatever cell is under the pointer.
 */
export function RecordMap({
  total,
  recordKeys,
  outcomes,
  fieldErrors,
  landedKeys,
  sweepKey,
  onOpen,
  compact = false,
}: {
  total: number;
  recordKeys: string[];
  outcomes?: RecordOutcome[];
  fieldErrors?: FieldError[];
  landedKeys?: Set<string>;
  sweepKey?: string;
  onOpen?: (outcome: RecordOutcome) => void;
  compact?: boolean;
}) {
  const cells = useMemo<Cell[]>(() => {
    const firstError = new Map<number, FieldError>();
    for (const e of fieldErrors ?? [])
      if (!firstError.has(e.rowIndex)) firstError.set(e.rowIndex, e);
    const byRow = new Map((outcomes ?? []).map((o) => [o.rowIndex, o]));
    return Array.from({ length: total }, (_, rowIndex) => {
      const outcome = byRow.get(rowIndex);
      const recordKey = outcome?.recordKey || recordKeys[rowIndex] || "";
      if (!outcome) return { rowIndex, recordKey, state: "pending" };
      if (outcome.status === "rejected") {
        const e = firstError.get(rowIndex);
        return {
          rowIndex,
          recordKey,
          state: "held",
          outcome,
          reason: e ? `${e.code} on ${e.targetField}` : undefined,
        };
      }
      return {
        rowIndex,
        recordKey,
        state:
          typeof outcome.row.legacy_id === "string" &&
          landedKeys?.has(outcome.row.legacy_id)
            ? "landed"
            : "accepted",
        outcome,
      };
    });
  }, [total, recordKeys, outcomes, fieldErrors, landedKeys]);

  const [focus, setFocus] = useState<Cell | null>(null);
  const tally = cells.reduce(
    (acc, c) => ({ ...acc, [c.state]: acc[c.state] + 1 }),
    { pending: 0, accepted: 0, held: 0, landed: 0 } as Record<
      CellState,
      number
    >,
  );

  return (
    <div className={`record-map ${compact ? "compact" : ""}`}>
      <p className="sr-only">
        {total} source records: {tally.accepted} accepted, {tally.held} held,{" "}
        {tally.landed} landed, {tally.pending} not inspected.
      </p>
      <div
        className="record-grid"
        key={sweepKey}
        onMouseLeave={() => setFocus(null)}
      >
        {cells.map((c) =>
          c.state === "held" && onOpen && c.outcome ? (
            <button
              key={c.rowIndex}
              type="button"
              className={`cell ${c.state}`}
              style={{ "--i": c.rowIndex } as React.CSSProperties}
              aria-label={`Row ${c.rowIndex + 1}, ${c.recordKey || "blank key"}, held: ${c.reason ?? "see evidence"}`}
              onMouseEnter={() => setFocus(c)}
              onFocus={() => setFocus(c)}
              onBlur={() => setFocus(null)}
              onClick={() => onOpen(c.outcome!)}
            />
          ) : (
            <span
              key={c.rowIndex}
              className={`cell ${c.state}`}
              style={{ "--i": c.rowIndex } as React.CSSProperties}
              aria-hidden="true"
              onMouseEnter={() => setFocus(c)}
            />
          ),
        )}
      </div>
      <div className="record-readout" aria-live="polite">
        {focus ? (
          <>
            <span className="mono">
              ROW {String(focus.rowIndex + 1).padStart(3, "0")}
            </span>
            <span className="mono">{focus.recordKey || "(blank key)"}</span>
            <span className={`readout-state ${focus.state}`}>
              {LABEL[focus.state]}
            </span>
            {focus.reason && <span className="mono">{focus.reason}</span>}
            {focus.state === "held" && onOpen && (
              <span className="readout-hint">Click to open evidence</span>
            )}
          </>
        ) : (
          <span className="readout-hint">
            {outcomes
              ? "Point at a record to read it. Hatched records are held; select one to open its evidence."
              : "Run a dry run to inspect every record."}
          </span>
        )}
      </div>
      <ul className="record-legend">
        <li>
          <span className="cell accepted" aria-hidden="true" />
          Accepted <b>{tally.accepted + tally.landed}</b>
        </li>
        <li>
          <span className="cell held" aria-hidden="true" />
          Held <b>{tally.held}</b>
        </li>
        {landedKeys && (
          <li>
            <span className="cell landed" aria-hidden="true" />
            Landed <b>{tally.landed}</b>
          </li>
        )}
        <li>
          <span className="cell pending" aria-hidden="true" />
          Not inspected <b>{tally.pending}</b>
        </li>
      </ul>
    </div>
  );
}
