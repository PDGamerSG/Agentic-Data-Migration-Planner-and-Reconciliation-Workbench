import { hash } from "./hash";
import type { RunResult, Scalar } from "./types";
export function reconcile(
  result: RunResult,
  targetRows: Record<string, Scalar>[],
  baselineCount: number,
  totalTarget: number,
  rolledBack = false,
) {
  const expected = rolledBack
    ? []
    : result.outcomes.filter((o) => o.status === "accepted");
  const byId = new Map(targetRows.map((r) => [String(r.legacy_id), r]));
  const missing = expected
    .filter((o) => !byId.has(String(o.row.legacy_id)))
    .map((o) => o.recordKey);
  const expectedIds = new Set(expected.map((o) => String(o.row.legacy_id)));
  const unexpected = targetRows
    .filter((r) => !expectedIds.has(String(r.legacy_id)))
    .map((r) => String(r.legacy_id));
  const mismatches = expected
    .filter((o) => {
      const r = byId.get(String(o.row.legacy_id));
      if (!r) return false;
      return (
        hash(
          Object.fromEntries(Object.keys(o.row).map((k) => [k, r[k] ?? null])),
        ) !== o.rowHash
      );
    })
    .map((o) => o.recordKey);
  const expectedCents = expected.reduce(
    (n, o) => n + Number(o.row.credit_limit_cents),
    0,
  );
  const actualCents = targetRows.reduce(
    (n, r) => n + Number(r.credit_limit_cents),
    0,
  );
  const checks = [
    {
      label: "Source accounting",
      expected: result.counts.source,
      actual: result.counts.accepted + result.counts.rejected,
    },
    {
      label: "Quarantined records",
      expected: result.counts.rejected,
      actual: result.outcomes.filter((o) => o.status === "rejected").length,
    },
    {
      label: "Migration rows",
      expected: expected.length,
      actual: targetRows.length,
    },
    {
      label: "Total target rows",
      expected: baselineCount + expected.length,
      actual: totalTarget,
    },
    {
      label: "Credit limit · cents",
      expected: expectedCents,
      actual: actualCents,
    },
  ].map((c) => ({ ...c, matched: c.expected === c.actual }));
  return {
    status:
      checks.every((c) => c.matched) &&
      !missing.length &&
      !unexpected.length &&
      !mismatches.length
        ? "matched"
        : "mismatch",
    checks,
    missing,
    unexpected,
    mismatches,
    rolledBack,
  };
}
