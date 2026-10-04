import type { PlanSpec, TransformStep } from "@manifest/core";
export function createReferencePlan(
  answers: Record<string, string> = {},
): PlanSpec {
  const dateOrder =
    answers.date_order === "DD/MM/YYYY"
      ? (["DD/MM/YYYY", "MM/DD/YYYY"] as const)
      : (["MM/DD/YYYY", "DD/MM/YYYY"] as const);
  const statusMap: Record<string, string> = {
    A: "active",
    I: "inactive",
    S: "suspended",
    active: "active",
    inactive: "inactive",
    suspended: "suspended",
  };
  if (["inactive", "suspended"].includes(answers.unknown_status ?? ""))
    statusMap.X = answers.unknown_status!;
  const creditSteps: TransformStep[] = [{ op: "trim" }];
  if (answers.missing_credit === "zero")
    creditSteps.push({
      op: "map_values",
      mapping: { "N/A": "0" },
      caseInsensitive: true,
      fallback: "keep",
    });
  creditSteps.push({ op: "currency_to_cents" });
  return {
    recordKey: { sourceField: "cust_id" },
    asOfDate: "2026-10-04",
    onTargetConflict: "reject",
    dedupe: {
      targetField: "email",
      keep: answers.duplicates === "none" ? "none" : "first",
    },
    mappings: [
      {
        targetField: "legacy_id",
        sources: ["cust_id"],
        steps: [{ op: "trim" }],
      },
      {
        targetField: "first_name",
        sources: ["full_name"],
        steps: [{ op: "trim" }, { op: "split_name", part: "first" }],
      },
      {
        targetField: "last_name",
        sources: ["full_name"],
        steps: [{ op: "trim" }, { op: "split_name", part: "last" }],
      },
      {
        targetField: "email",
        sources: ["email_addr"],
        steps: [{ op: "trim" }, { op: "lowercase" }],
      },
      {
        targetField: "phone_e164",
        sources: ["phone"],
        steps: [
          { op: "trim" },
          { op: "null_if_empty" },
          { op: "phone_to_e164", defaultCountry: "IN" },
        ],
      },
      {
        targetField: "status",
        sources: ["status_cd"],
        steps: [
          { op: "trim" },
          {
            op: "map_values",
            mapping: statusMap,
            caseInsensitive: true,
            fallback: "reject",
          },
        ],
      },
      {
        targetField: "tier",
        sources: ["vip_flag"],
        steps: [
          { op: "trim" },
          {
            op: "map_values",
            mapping: {
              Y: "vip",
              yes: "vip",
              N: "standard",
              no: "standard",
              "": "standard",
            },
            caseInsensitive: true,
            fallback: "reject",
          },
        ],
      },
      {
        targetField: "country_code",
        sources: ["country"],
        steps: [{ op: "trim" }, { op: "country_to_iso2" }],
      },
      {
        targetField: "postal_code",
        sources: ["zip"],
        steps: [{ op: "trim" }, { op: "null_if_empty" }],
      },
      {
        targetField: "credit_limit_cents",
        sources: ["credit_limit"],
        steps: creditSteps,
      },
      {
        targetField: "date_of_birth",
        sources: ["birth_date"],
        steps: [
          { op: "trim" },
          { op: "null_if_empty" },
          { op: "parse_date", formats: ["YYYY-MM-DD"] },
        ],
      },
      {
        targetField: "created_at",
        sources: ["signup_dt"],
        steps: [
          { op: "trim" },
          {
            op: "parse_date",
            formats: ["YYYY-MM-DD", ...dateOrder, "DD Mon YYYY"],
          },
          { op: "date_to_timestamp" },
        ],
      },
      {
        targetField: "marketing_opt_in",
        sources: [],
        steps: [{ op: "constant", value: false }],
      },
    ],
    unmappedSourceFields: [
      {
        field: "notes",
        decision: "drop",
        reason: "No target field; human must acknowledge loss of legacy notes.",
      },
      {
        field: "last_login_ip",
        decision: "drop",
        reason: "Personal data without a target field; intentionally excluded.",
      },
    ],
  };
}
export const referencePlan = createReferencePlan();
