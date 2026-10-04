import { CATALOG } from "./transforms";
import { canonicalJson } from "./hash";
import {
  planSpecSchema,
  type PlanSpec,
  type PlanIssue,
  type SourceSchema,
  type TargetSchema,
  type ValueType,
} from "./types";
const valueType = (v: unknown): ValueType =>
  typeof v === "number"
    ? "integer"
    : typeof v === "boolean"
      ? "boolean"
      : "string";
export function checkPlan(
  spec: PlanSpec,
  source: SourceSchema,
  target: TargetSchema,
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const error = (code: string, field: string, message: string) =>
    issues.push({ severity: "error", code, field, message });
  const parsed = planSpecSchema.safeParse(spec);
  if (!parsed.success)
    return parsed.error.issues.map((i) => ({
      severity: "error",
      code: "INVALID_PLAN",
      field: i.path.join("."),
      message: i.message,
    }));
  const sourceFields = new Set(source.fields.map((f) => f.name));
  const handled = new Set<string>();
  const mapped = new Set<string>();
  if (!sourceFields.has(spec.recordKey.sourceField))
    error("UNKNOWN_SOURCE_FIELD", "recordKey", "Unknown record key field");
  for (const mapping of spec.mappings) {
    const field = target.fields.find((f) => f.name === mapping.targetField);
    if (!field) {
      error(
        "UNKNOWN_TARGET_FIELD",
        mapping.targetField,
        "Unknown target field",
      );
      continue;
    }
    if (mapped.has(field.name))
      error("DUPLICATE_MAPPING", field.name, "Target has multiple mappings");
    mapped.add(field.name);
    for (const name of mapping.sources) {
      if (!sourceFields.has(name))
        error("UNKNOWN_SOURCE_FIELD", field.name, `Unknown source ${name}`);
      handled.add(name);
    }
    let type: ValueType | "array" | "none" =
      mapping.sources.length === 0
        ? "none"
        : mapping.sources.length > 1
          ? "array"
          : "string";
    if (mapping.sources.length === 0 && mapping.steps[0]?.op !== "constant")
      error(
        "MISSING_CONSTANT",
        field.name,
        "A source-free mapping must begin with constant",
      );
    for (const [index, step] of mapping.steps.entries()) {
      const signature = CATALOG[step.op]!;
      if (step.op === "constant" && (index !== 0 || mapping.sources.length > 0))
        error(
          "INVALID_CONSTANT",
          field.name,
          "constant must begin a source-free pipeline",
        );
      if (step.op === "concat" && index !== 0)
        error("INVALID_CONCAT", field.name, "concat must be the first step");
      if (signature.input !== "any" && signature.input !== type)
        error(
          "TYPE_MISMATCH",
          field.name,
          `${step.op} expects ${signature.input}, received ${type}`,
        );
      if (
        step.op === "default_if_null" &&
        step.value !== null &&
        valueType(step.value) !== type
      )
        error(
          "TYPE_MISMATCH",
          field.name,
          "Default must preserve the pipeline type",
        );
      if (signature.output === "value" && "value" in step)
        type = valueType(step.value);
      else if (signature.output !== "same" && signature.output !== "value")
        type = signature.output;
    }
    if (type !== field.type && !(field.type === "enum" && type === "string"))
      error(
        "TYPE_MISMATCH",
        field.name,
        `Output ${type} is incompatible with ${field.type}`,
      );
  }
  for (const field of target.fields)
    if (field.required && !mapped.has(field.name))
      error(
        "UNMAPPED_REQUIRED",
        field.name,
        "Required target field is unmapped",
      );
  const dropped = new Set<string>();
  for (const drop of spec.unmappedSourceFields) {
    if (!sourceFields.has(drop.field))
      error("UNKNOWN_SOURCE_FIELD", drop.field, "Unknown dropped source field");
    if (handled.has(drop.field) || dropped.has(drop.field))
      error(
        "INVALID_DROP",
        drop.field,
        "Dropped field is also mapped or duplicated",
      );
    dropped.add(drop.field);
    handled.add(drop.field);
  }
  for (const name of sourceFields)
    if (!handled.has(name))
      error(
        "SOURCE_FIELD_UNHANDLED",
        name,
        "Explicitly map or drop every source field",
      );
  if (spec.dedupe && !mapped.has(spec.dedupe.targetField))
    error(
      "UNMAPPED_DEDUPE",
      spec.dedupe.targetField,
      "Dedupe field must be mapped",
    );
  return issues;
}
export function diffPlans(a: PlanSpec, b: PlanSpec) {
  const old = new Map(a.mappings.map((m) => [m.targetField, m]));
  const next = new Map(b.mappings.map((m) => [m.targetField, m]));
  return {
    changedMappings: [...next.keys()].filter(
      (k) =>
        old.has(k) && canonicalJson(old.get(k)) !== canonicalJson(next.get(k)),
    ),
    addedMappings: [...next.keys()].filter((k) => !old.has(k)),
    removedMappings: [...old.keys()].filter((k) => !next.has(k)),
    changedSettings: (
      [
        "recordKey",
        "unmappedSourceFields",
        "dedupe",
        "onTargetConflict",
        "asOfDate",
      ] as const
    ).filter((k) => canonicalJson(a[k]) !== canonicalJson(b[k])),
  };
}
