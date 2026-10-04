import { hash } from "./hash";
import { applyStep, TransformError, validDate } from "./transforms";
import { checkPlan } from "./plan";
import {
  MAX_SOURCE_RECORDS,
  type SourceSchema,
  type TargetSchema,
  type PlanSpec,
  type SourceRecord,
  type Scalar,
  type FieldMapping,
  type FieldError,
  type Trace,
  type Counts,
  type RecordOutcome,
  type ExistingTargetKeys,
  type RunResult,
  type ErrorCode,
  type Stage,
} from "./types";
export function testMapping(mapping: FieldMapping, records: SourceRecord[]) {
  const failures: { rowIndex: number; code: ErrorCode; message: string }[] = [];
  let succeeded = 0;
  for (const rec of records) {
    try {
      transformMapping(mapping, rec);
      succeeded++;
    } catch (error) {
      const e = error as TransformError;
      failures.push({
        rowIndex: rec.rowIndex,
        code: e.code,
        message: e.message,
      });
    }
  }
  return {
    total: records.length,
    succeeded,
    successRate: records.length ? succeeded / records.length : 0,
    failures: failures.slice(0, 5),
  };
}
function transformMapping(
  mapping: FieldMapping,
  rec: SourceRecord,
  trace?: Trace,
  onError?: (
    e: TransformError,
    stepIndex: number,
    value: Scalar | Scalar[],
  ) => void,
): Scalar {
  let value: Scalar | Scalar[] =
    mapping.sources.length > 1
      ? mapping.sources.map((s) => rec.payload[s] ?? null)
      : mapping.sources.length === 1
        ? (rec.payload[mapping.sources[0]!] ?? null)
        : null;
  for (const [stepIndex, step] of mapping.steps.entries()) {
    const input = value;
    try {
      value = applyStep(step, value);
      trace?.steps.push({ op: step.op, input, output: value, ok: true });
    } catch (error) {
      const e = error as TransformError;
      trace?.steps.push({ op: step.op, input, output: null, ok: false });
      if (onError) {
        onError(e, stepIndex, input);
        return null;
      }
      throw error;
    }
  }
  return value as Scalar;
}
export function runPlan(input: {
  spec: PlanSpec;
  source: SourceSchema;
  target: TargetSchema;
  records: SourceRecord[];
  existing: ExistingTargetKeys;
}): RunResult {
  const { spec, source, target, records, existing } = input;
  if (records.length > MAX_SOURCE_RECORDS)
    throw new Error(`Maximum sample size is ${MAX_SOURCE_RECORDS}`);
  if (new Set(records.map((r) => r.rowIndex)).size !== records.length)
    throw new Error("Row indexes must be unique");
  const issues = checkPlan(spec, source, target).filter(
    (i) => i.severity === "error",
  );
  if (issues.length)
    throw new Error(issues.map((i) => `${i.field}: ${i.message}`).join("; "));
  const sorted = [...records].sort((a, b) => a.rowIndex - b.rowIndex);
  const counts: Counts = {
    source: sorted.length,
    transformed: 0,
    accepted: 0,
    rejected: 0,
    rejectedByStage: {
      transform: 0,
      validate: 0,
      dedupe: 0,
      target_conflict: 0,
    },
  };
  const outcomes: RecordOutcome[] = [];
  const fieldErrors: FieldError[] = [];
  const seenKeys = new Set<string>();
  const seenEmails = new Set<string>();
  const seenLegacyIds = new Set<string>();
  const existingEmails = new Set(existing.emails.map((e) => e.toLowerCase()));
  const existingIds = new Set(existing.legacyIds);
  const duplicateEmails = new Set<string>();
  if (spec.dedupe?.keep === "none") {
    const freq = new Map<string, number>();
    const m = spec.mappings.find((m) => m.targetField === "email")!;
    for (const rec of sorted) {
      try {
        const v = transformMapping(m, rec);
        if (typeof v === "string") freq.set(v, (freq.get(v) ?? 0) + 1);
      } catch {
        /* Other errors are captured in the main pass. */
      }
    }
    for (const [email, count] of freq)
      if (count > 1) duplicateEmails.add(email);
  }
  for (const rec of sorted) {
    const recordKey = (rec.payload[spec.recordKey.sourceField] ?? "").trim();
    const errors: FieldError[] = [];
    const row: Record<string, Scalar> = {};
    const trace: Trace[] = [];
    const add = (
      targetField: string,
      stage: Stage,
      code: ErrorCode,
      message: string,
      valueAtFailure: Scalar | Scalar[],
      stepIndex: number | null = null,
      op: string | null = null,
    ) => {
      const mapping = spec.mappings.find((m) => m.targetField === targetField);
      const fields =
        mapping?.sources ??
        (targetField === "*" ? [spec.recordKey.sourceField] : []);
      errors.push({
        rowIndex: rec.rowIndex,
        recordKey,
        targetField,
        sourceFields: fields,
        sourceValues: Object.fromEntries(
          fields.map((f) => [f, rec.payload[f] ?? null]),
        ),
        stage,
        code,
        message,
        valueAtFailure,
        stepIndex,
        op,
      });
    };
    for (const mapping of spec.mappings) {
      const t: Trace = { targetField: mapping.targetField, steps: [] };
      trace.push(t);
      row[mapping.targetField] = transformMapping(
        mapping,
        rec,
        t,
        (e, index, v) =>
          add(
            mapping.targetField,
            "transform",
            e.code,
            e.message,
            v,
            index,
            mapping.steps[index]!.op,
          ),
      );
    }
    if (!errors.some((e) => e.stage === "transform")) counts.transformed++;
    for (const field of target.fields) {
      if (errors.some((e) => e.targetField === field.name)) continue;
      const v = row[field.name] ?? null;
      if (v === null || v === "") {
        if (field.required)
          add(
            field.name,
            "validate",
            "REQUIRED_MISSING",
            "Required value is missing",
            v,
          );
        continue;
      }
      if (
        field.type === "integer" &&
        (!Number.isInteger(v) || typeof v !== "number")
      )
        add(field.name, "validate", "TYPE_MISMATCH", "Expected integer", v);
      if (field.type === "boolean" && typeof v !== "boolean")
        add(field.name, "validate", "TYPE_MISMATCH", "Expected boolean", v);
      if (
        ["string", "enum", "date", "timestamp"].includes(field.type) &&
        typeof v !== "string"
      )
        add(field.name, "validate", "TYPE_MISMATCH", "Expected string", v);
      if (typeof v === "string") {
        if (field.maxLength && v.length > field.maxLength)
          add(
            field.name,
            "validate",
            "TOO_LONG",
            `Maximum length is ${field.maxLength}`,
            v,
          );
        if (field.enum && !field.enum.includes(v))
          add(
            field.name,
            "validate",
            "UNKNOWN_VALUE",
            "Value is outside target enum",
            v,
          );
        if (
          field.format === "email" &&
          (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v !== v.toLowerCase())
        )
          add(
            field.name,
            "validate",
            "INVALID_FORMAT",
            "Expected a normalized email address",
            v,
          );
        if (field.format === "phone" && !/^\+[1-9]\d{7,14}$/.test(v))
          add(
            field.name,
            "validate",
            "INVALID_FORMAT",
            "Expected an E.164 phone",
            v,
          );
        if (field.format === "country" && !/^[A-Z]{2}$/.test(v))
          add(
            field.name,
            "validate",
            "INVALID_FORMAT",
            "Expected two-letter country code",
            v,
          );
        if (field.type === "date" && !validDate(v))
          add(
            field.name,
            "validate",
            "INVALID_FORMAT",
            "Expected a real ISO date",
            v,
          );
        if (
          field.type === "timestamp" &&
          (!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(v) ||
            !validDate(v.slice(0, 10)))
        )
          add(
            field.name,
            "validate",
            "INVALID_FORMAT",
            "Expected UTC midnight timestamp",
            v,
          );
        if (field.notAfterAsOfDate && v > spec.asOfDate)
          add(
            field.name,
            "validate",
            "OUT_OF_RANGE",
            `Date is after ${spec.asOfDate}`,
            v,
          );
      }
      if (
        typeof v === "number" &&
        (v > 2147483647 || (field.min !== undefined && v < field.min))
      )
        add(
          field.name,
          "validate",
          "OUT_OF_RANGE",
          "Value is outside target range",
          v,
        );
    }
    if (!recordKey)
      add(
        "*",
        "validate",
        "REQUIRED_MISSING",
        "Record key is blank",
        recordKey,
      );
    if (recordKey && seenKeys.has(recordKey))
      add(
        "*",
        "dedupe",
        "DUPLICATE_KEY",
        "Repeated source record key",
        recordKey,
      );
    if (recordKey) seenKeys.add(recordKey);
    const email = String(row.email ?? "");
    const id = String(row.legacy_id ?? "");
    if (!errors.length) {
      if (seenLegacyIds.has(id))
        add(
          "legacy_id",
          "dedupe",
          "DUPLICATE_IN_SOURCE",
          "Repeated transformed legacy identifier",
          id,
        );
      if (seenEmails.has(email) || duplicateEmails.has(email))
        add(
          "email",
          "dedupe",
          "DUPLICATE_IN_SOURCE",
          "Repeated source email",
          email,
        );
      if (existingEmails.has(email) || existingIds.has(id))
        add(
          existingIds.has(id) ? "legacy_id" : "email",
          "target_conflict",
          "TARGET_CONFLICT",
          "Value already belongs to a target row",
          existingIds.has(id) ? id : email,
        );
    }
    const stage = errors[0]?.stage ?? null;
    if (stage) {
      counts.rejected++;
      counts.rejectedByStage[stage]++;
    } else {
      counts.accepted++;
      seenEmails.add(email);
      seenLegacyIds.add(id);
    }
    fieldErrors.push(...errors);
    outcomes.push({
      rowIndex: rec.rowIndex,
      recordKey,
      status: stage ? "rejected" : "accepted",
      stage,
      row,
      rowHash: stage ? null : hash(row),
      trace,
    });
  }
  const targetKeysHash = hash({
    emails: [...existingEmails].sort(),
    legacyIds: [...existingIds].sort(),
  });
  return {
    counts,
    outcomes,
    fieldErrors,
    targetKeysHash,
    resultHash: hash({
      specHash: hash(spec),
      datasetHash: hash(sorted),
      targetKeysHash,
      counts,
      outcomes,
      fieldErrors,
    }),
  };
}
