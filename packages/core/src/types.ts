import { z } from "zod";

export const MAX_SOURCE_RECORDS = 1000;
export type Scalar = string | number | boolean | null;
export type ValueType =
  "string" | "integer" | "boolean" | "date" | "timestamp" | "enum";
export type SourceRecord = {
  rowIndex: number;
  payload: Record<string, string | null>;
};
export type SourceSchema = {
  name: string;
  fields: { name: string; description: string }[];
};
export type TargetField = {
  name: string;
  type: ValueType;
  required: boolean;
  unique?: boolean;
  enum?: string[];
  maxLength?: number;
  min?: number;
  format?: "email" | "phone" | "country";
  notAfterAsOfDate?: boolean;
};
export type TargetSchema = { name: string; fields: TargetField[] };
const scalar = z.union([
  z.string().max(1000),
  z.number().int().safe(),
  z.boolean(),
  z.null(),
]);
export const transformStepSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.enum([
        "trim",
        "lowercase",
        "uppercase",
        "null_if_empty",
        "to_integer",
        "date_to_timestamp",
        "country_to_iso2",
        "currency_to_cents",
        "yes_no_to_boolean",
      ]),
    })
    .strict(),
  z
    .object({ op: z.literal("split_name"), part: z.enum(["first", "last"]) })
    .strict(),
  z
    .object({
      op: z.literal("strip_prefix"),
      prefix: z.string().min(1).max(10),
    })
    .strict(),
  z
    .object({
      op: z.literal("parse_date"),
      formats: z
        .array(
          z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "DD Mon YYYY"]),
        )
        .min(1)
        .max(4),
    })
    .strict(),
  z
    .object({
      op: z.literal("map_values"),
      mapping: z.record(z.string().max(100), z.string().max(100)),
      caseInsensitive: z.boolean(),
      fallback: z.enum(["reject", "null", "keep"]),
    })
    .strict(),
  z
    .object({
      op: z.literal("phone_to_e164"),
      defaultCountry: z.enum(["US", "IN", "GB", "DE"]),
    })
    .strict(),
  z.object({ op: z.literal("default_if_null"), value: scalar }).strict(),
  z.object({ op: z.literal("constant"), value: scalar }).strict(),
  z.object({ op: z.literal("concat"), separator: z.string().max(3) }).strict(),
]);
export type TransformStep = z.infer<typeof transformStepSchema>;
export const fieldMappingSchema = z
  .object({
    targetField: z.string().min(1).max(100),
    sources: z.array(z.string().max(100)).max(3),
    steps: z.array(transformStepSchema).max(8),
    rationale: z.string().max(500).optional(),
  })
  .strict();
export const planSpecSchema = z
  .object({
    recordKey: z.object({ sourceField: z.string().max(100) }).strict(),
    mappings: z.array(fieldMappingSchema).min(1).max(30),
    unmappedSourceFields: z
      .array(
        z
          .object({
            field: z.string().max(100),
            decision: z.literal("drop"),
            reason: z.string().min(1).max(300),
          })
          .strict(),
      )
      .max(30),
    dedupe: z
      .object({
        targetField: z.literal("email"),
        keep: z.enum(["first", "none"]),
      })
      .strict()
      .nullable(),
    onTargetConflict: z.literal("reject"),
    asOfDate: z.iso.date(),
  })
  .strict();
export type PlanSpec = z.infer<typeof planSpecSchema>;
export type FieldMapping = z.infer<typeof fieldMappingSchema>;
export type PlanIssue = {
  severity: "error" | "warning";
  code: string;
  field: string;
  message: string;
};
export type ErrorCode =
  | "REQUIRED_MISSING"
  | "TYPE_MISMATCH"
  | "INVALID_FORMAT"
  | "PARSE_DATE_FAILED"
  | "PARSE_NUMBER_FAILED"
  | "UNKNOWN_VALUE"
  | "OUT_OF_RANGE"
  | "TOO_LONG"
  | "DUPLICATE_KEY"
  | "DUPLICATE_IN_SOURCE"
  | "TARGET_CONFLICT";
export type Stage = "transform" | "validate" | "dedupe" | "target_conflict";
export type FieldError = {
  rowIndex: number;
  recordKey: string;
  targetField: string;
  sourceFields: string[];
  sourceValues: Record<string, string | null>;
  stage: Stage;
  stepIndex: number | null;
  op: string | null;
  valueAtFailure: Scalar | Scalar[];
  code: ErrorCode;
  message: string;
};
export type Trace = {
  targetField: string;
  steps: {
    op: string;
    input: Scalar | Scalar[];
    output: Scalar | null;
    ok: boolean;
  }[];
};
export type RecordOutcome = {
  rowIndex: number;
  recordKey: string;
  status: "accepted" | "rejected";
  stage: Stage | null;
  row: Record<string, Scalar>;
  rowHash: string | null;
  trace: Trace[];
};
export type Counts = {
  source: number;
  transformed: number;
  accepted: number;
  rejected: number;
  rejectedByStage: Record<Stage, number>;
};
export type ExistingTargetKeys = { emails: string[]; legacyIds: string[] };
export type RunResult = {
  counts: Counts;
  outcomes: RecordOutcome[];
  fieldErrors: FieldError[];
  resultHash: string;
  targetKeysHash: string;
};
