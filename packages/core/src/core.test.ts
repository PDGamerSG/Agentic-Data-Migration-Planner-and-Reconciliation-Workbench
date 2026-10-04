import { describe, expect, it } from "vitest";
import {
  sourceSchema,
  targetSchema,
  sampleRecords,
  targetSeed,
  referencePlan,
} from "../../fixtures/src";
import {
  applyStep,
  checkPlan,
  hash,
  runPlan,
  reconcile,
  planSpecSchema,
  diffPlans,
} from "./index";
const input = {
  spec: referencePlan,
  source: sourceSchema,
  target: targetSchema,
  records: sampleRecords,
  existing: { emails: targetSeed.map((r) => r.email), legacyIds: [] },
};
describe("closed transformation catalog", () => {
  it.each([
    ["$1,200.50", 120050],
    ["0.01", 1],
    ["-50", -5000],
    ["₹100", 10000],
  ])("parses %s in integer cents", (value, expected) =>
    expect(applyStep({ op: "currency_to_cents" }, value)).toBe(expected),
  );
  it.each(["N/A", "1,20.00", "1.001", "1e6", "Infinity", "21474836.48"])(
    "rejects currency %s",
    (value) =>
      expect(() => applyStep({ op: "currency_to_cents" }, value)).toThrow(),
  );
  it("handles calendar leap years and rejects rollover dates", () => {
    expect(
      applyStep({ op: "parse_date", formats: ["YYYY-MM-DD"] }, "2024-02-29"),
    ).toBe("2024-02-29");
    for (const date of ["2023-02-29", "2024-02-30", "0000-01-01"])
      expect(() =>
        applyStep({ op: "parse_date", formats: ["YYYY-MM-DD"] }, date),
      ).toThrow();
  });
  it("uses explicit date precedence", () => {
    expect(
      applyStep(
        { op: "parse_date", formats: ["DD/MM/YYYY", "MM/DD/YYYY"] },
        "04/05/2021",
      ),
    ).toBe("2021-05-04");
  });
  it("handles names, empty values, booleans and countries", () => {
    expect(
      applyStep({ op: "split_name", part: "first" }, "de la Cruz, Maria"),
    ).toBe("Maria");
    expect(applyStep({ op: "split_name", part: "last" }, "Prince")).toBeNull();
    expect(applyStep({ op: "null_if_empty" }, " ")).toBeNull();
    expect(applyStep({ op: "yes_no_to_boolean" }, "YES")).toBe(true);
    expect(applyStep({ op: "country_to_iso2" }, "Deutschland")).toBe("DE");
  });
  it("supports the remaining catalog operations", () => {
    expect(applyStep({ op: "uppercase" }, "in")).toBe("IN");
    expect(applyStep({ op: "strip_prefix", prefix: "C-" }, "C-42")).toBe("42");
    expect(applyStep({ op: "to_integer" }, "42")).toBe(42);
    expect(applyStep({ op: "concat", separator: " " }, ["A", "B"])).toBe("A B");
    expect(applyStep({ op: "default_if_null", value: false }, null)).toBe(
      false,
    );
    expect(
      applyStep({ op: "phone_to_e164", defaultCountry: "IN" }, "98765 43210"),
    ).toBe("+919876543210");
  });
  it("rejects arbitrary transformations and unexpected params", () => {
    const spec = structuredClone(referencePlan);
    expect(
      planSpecSchema.safeParse({
        ...spec,
        mappings: [
          { ...spec.mappings[0], steps: [{ op: "eval", code: "anything" }] },
        ],
      }).success,
    ).toBe(false);
  });
});
describe("plan validation", () => {
  it("checks the reference plan", () =>
    expect(checkPlan(referencePlan, sourceSchema, targetSchema)).toEqual([]));
  it("blocks required fields, unknown fields and incompatible pipelines", () => {
    const s = structuredClone(referencePlan);
    s.mappings = s.mappings.filter((m) => m.targetField !== "marketing_opt_in");
    s.mappings[0]!.sources = ["absent"];
    s.mappings.find((m) => m.targetField === "credit_limit_cents")!.steps = [
      { op: "trim" },
    ];
    expect(checkPlan(s, sourceSchema, targetSchema).map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "UNMAPPED_REQUIRED",
        "UNKNOWN_SOURCE_FIELD",
        "TYPE_MISMATCH",
      ]),
    );
  });
  it("hashes canonical key order and diffs versions", () => {
    expect(hash({ b: 2, a: 1 })).toBe(hash({ a: 1, b: 2 }));
    const s = { ...referencePlan, asOfDate: "2025-01-01" };
    expect(diffPlans(referencePlan, s).changedSettings).toEqual(["asOfDate"]);
  });
});
describe("deterministic dry run", () => {
  it("preserves all count invariants", () => {
    const { counts } = runPlan(input);
    expect(counts.source).toBe(250);
    expect(counts.accepted + counts.rejected).toBe(250);
    expect(counts.accepted).toBeLessThanOrEqual(counts.transformed);
    expect(
      Object.values(counts.rejectedByStage).reduce((a, b) => a + b, 0),
    ).toBe(counts.rejected);
  });
  it("is byte-identical on repeat and input reordering", () => {
    const a = runPlan(input);
    expect(runPlan(input)).toEqual(a);
    expect(
      runPlan({
        ...input,
        records: [...sampleRecords].reverse(),
        existing: {
          ...input.existing,
          emails: [...input.existing.emails].reverse(),
        },
      }),
    ).toEqual(a);
  });
  it("retains original values, transform step and multiple errors", () => {
    const r = runPlan(input);
    expect(r.fieldErrors).toContainEqual(
      expect.objectContaining({
        rowIndex: 17,
        targetField: "email",
        stage: "validate",
        code: "INVALID_FORMAT",
        sourceValues: { email_addr: "asha@@example" },
      }),
    );
    expect(r.fieldErrors).toContainEqual(
      expect.objectContaining({
        rowIndex: 30,
        op: "parse_date",
        stage: "transform",
        stepIndex: 1,
      }),
    );
    expect(r.fieldErrors.filter((e) => e.rowIndex === 99)).toHaveLength(2);
  });
  it("quarantines duplicates and target conflicts", () => {
    const r = runPlan(input);
    expect(r.outcomes[21]!.stage).toBe("dedupe");
    expect(r.outcomes[71]!.stage).toBe("dedupe");
    expect(r.outcomes[10]!.stage).toBe("target_conflict");
  });
  it("quarantines all duplicates under none policy", () => {
    const r = runPlan({
      ...input,
      spec: {
        ...referencePlan,
        dedupe: { targetField: "email", keep: "none" },
      },
    });
    expect(r.outcomes[20]!.status).toBe("rejected");
    expect(r.outcomes[21]!.status).toBe("rejected");
  });
  it("enforces sample bounds and distinct row indexes", () => {
    expect(() =>
      runPlan({
        ...input,
        records: Array.from({ length: 1001 }, (_, i) => ({
          ...sampleRecords[0]!,
          rowIndex: i,
        })),
      }),
    ).toThrow("Maximum");
    expect(() =>
      runPlan({ ...input, records: [sampleRecords[0]!, sampleRecords[0]!] }),
    ).toThrow("unique");
  });
  it("changes fingerprints when the plan changes", () =>
    expect(
      runPlan({ ...input, spec: { ...referencePlan, asOfDate: "2000-01-01" } })
        .resultHash,
    ).not.toBe(runPlan(input).resultHash));
  it("reconciles content and cents and detects tampering", () => {
    const r = runPlan(input);
    const rows = r.outcomes
      .filter((o) => o.status === "accepted")
      .map((o) => o.row);
    expect(reconcile(r, rows, 20, 20 + rows.length).status).toBe("matched");
    const changed = structuredClone(rows);
    changed[0]!.first_name = "Changed";
    expect(reconcile(r, changed, 20, 20 + rows.length).mismatches).toHaveLength(
      1,
    );
    expect(reconcile(r, [], 20, 20, true).status).toBe("matched");
  });
});

describe("transformed uniqueness and dictionary determinism", () => {
  it("rejects case-folded dictionary collisions", () => {
    const spec = structuredClone(referencePlan);
    spec.mappings.find((m) => m.targetField === "status")!.steps = [
      {
        op: "map_values",
        mapping: { A: "active", a: "inactive" },
        caseInsensitive: true,
        fallback: "reject",
      },
    ];
    expect(
      checkPlan(spec, sourceSchema, targetSchema).map((i) => i.code),
    ).toContain("AMBIGUOUS_DICTIONARY");
  });
  it("quarantines transformed legacy identifiers that collapse to one value", () => {
    const spec = structuredClone(referencePlan);
    spec.mappings
      .find((m) => m.targetField === "legacy_id")!
      .steps.push({
        op: "map_values",
        mapping: { "C-000001": "shared", "C-000002": "shared" },
        caseInsensitive: false,
        fallback: "keep",
      });
    const result = runPlan({ ...input, spec });
    expect(result.outcomes[0]!.status).toBe("accepted");
    expect(result.outcomes[1]!.status).toBe("rejected");
    expect(result.fieldErrors).toContainEqual(
      expect.objectContaining({
        rowIndex: 1,
        targetField: "legacy_id",
        code: "DUPLICATE_IN_SOURCE",
      }),
    );
  });
  it("rejects object prototype names as countries", () =>
    expect(() => applyStep({ op: "country_to_iso2" }, "__proto__")).toThrow());
});
