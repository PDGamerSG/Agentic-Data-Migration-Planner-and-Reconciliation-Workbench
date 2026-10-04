"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { PlanSpec, TransformStep } from "@manifest/core";
import { transformStepSchema } from "@manifest/core/types";
import { CATALOG } from "@manifest/core/transforms";
const formats = [
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "DD Mon YYYY",
] as const;
function defaultStep(op: string): TransformStep {
  switch (op) {
    case "split_name":
      return { op, part: "first" };
    case "strip_prefix":
      return { op, prefix: "C-" };
    case "parse_date":
      return {
        op,
        formats: ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "DD Mon YYYY"],
      };
    case "map_values":
      return { op, mapping: {}, caseInsensitive: true, fallback: "reject" };
    case "phone_to_e164":
      return { op, defaultCountry: "IN" };
    case "default_if_null":
    case "constant":
      return { op, value: null };
    case "concat":
      return { op, separator: " " };
    default:
      return transformStepSchema.parse({ op });
  }
}
function StepParams({
  step,
  onChange,
}: {
  step: TransformStep;
  onChange: (step: TransformStep) => void;
}) {
  const [error, setError] = useState("");
  const [raw, setRaw] = useState(
    "mapping" in step
      ? JSON.stringify(step.mapping, null, 2)
      : "value" in step
        ? JSON.stringify(step.value)
        : "",
  );
  const validate = (next: unknown) => {
    const parsed = transformStepSchema.safeParse(next);
    if (parsed.success) {
      setError("");
      onChange(parsed.data);
    } else setError(parsed.error.issues[0]?.message ?? "Invalid parameter");
  };
  switch (step.op) {
    case "split_name":
      return (
        <select
          aria-label="Name part"
          value={step.part}
          onChange={(e) => validate({ ...step, part: e.target.value })}
        >
          <option value="first">First name</option>
          <option value="last">Last name</option>
        </select>
      );
    case "strip_prefix":
      return (
        <input
          aria-label="Prefix to remove"
          value={step.prefix}
          maxLength={10}
          onChange={(e) => validate({ ...step, prefix: e.target.value })}
        />
      );
    case "concat":
      return (
        <input
          aria-label="Join separator"
          value={step.separator}
          maxLength={3}
          onChange={(e) => validate({ ...step, separator: e.target.value })}
        />
      );
    case "phone_to_e164":
      return (
        <select
          aria-label="Default phone country"
          value={step.defaultCountry}
          onChange={(e) =>
            validate({ ...step, defaultCountry: e.target.value })
          }
        >
          {["IN", "US", "GB", "DE"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      );
    case "parse_date":
      return (
        <div className="format-order">
          <small>Formats are tried in this order:</small>
          {step.formats.map((f, index) => (
            <div key={f}>
              <code>{f}</code>
              <button
                className="icon-button"
                disabled={index === 0}
                onClick={() => {
                  const next = [...step.formats];
                  [next[index - 1], next[index]] = [
                    next[index]!,
                    next[index - 1]!,
                  ];
                  onChange({ ...step, formats: next });
                }}
                aria-label={`Move ${f} earlier`}
              >
                <ArrowUp size={12} />
              </button>
              <button
                className="icon-button"
                disabled={step.formats.length === 1}
                onClick={() =>
                  onChange({
                    ...step,
                    formats: step.formats.filter((v) => v !== f),
                  })
                }
                aria-label={`Remove ${f}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <select
            aria-label="Add date format"
            value=""
            onChange={(e) =>
              validate({ ...step, formats: [...step.formats, e.target.value] })
            }
          >
            <option value="">Add a format…</option>
            {formats
              .filter((f) => !step.formats.includes(f))
              .map((f) => (
                <option key={f}>{f}</option>
              ))}
          </select>
        </div>
      );
    case "constant":
    case "default_if_null":
      return (
        <div>
          <input
            aria-label="Constant or default value"
            value={raw}
            placeholder='false, 0, null, or "text"'
            onChange={(e) => {
              setRaw(e.target.value);
              try {
                validate({ ...step, value: JSON.parse(e.target.value) });
              } catch {
                setError("Use a JSON string, integer, boolean or null.");
              }
            }}
          />
          {error && <small className="error">{error}</small>}
        </div>
      );
    case "map_values":
      return (
        <div className="dictionary-params">
          <label>
            Value dictionary
            <textarea
              aria-label="Value dictionary"
              rows={5}
              spellCheck={false}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                try {
                  validate({ ...step, mapping: JSON.parse(e.target.value) });
                } catch {
                  setError(
                    "Enter a JSON object of source values to target strings.",
                  );
                }
              }}
            />
          </label>
          {error && <small className="error">{error}</small>}
          <label className="check-label">
            <input
              type="checkbox"
              checked={step.caseInsensitive}
              onChange={(e) =>
                onChange({ ...step, caseInsensitive: e.target.checked })
              }
            />
            Ignore value casing
          </label>
          <label>
            Unmapped values
            <select
              aria-label="Dictionary fallback"
              value={step.fallback}
              onChange={(e) => validate({ ...step, fallback: e.target.value })}
            >
              <option value="reject">Quarantine</option>
              <option value="null">Set null</option>
              <option value="keep">Keep original</option>
            </select>
          </label>
        </div>
      );
    default:
      return <span className="param-hint">No parameters</span>;
  }
}
export function MappingEditor({
  spec,
  sourceFields,
  onChange,
}: {
  spec: PlanSpec;
  sourceFields: string[];
  onChange: (spec: PlanSpec) => void;
}) {
  return (
    <div className="mapping-editor">
      <div className="mapping-settings">
        <label>
          Validation reference date
          <input
            aria-label="Validation reference date"
            type="date"
            value={spec.asOfDate}
            onChange={(e) => onChange({ ...spec, asOfDate: e.target.value })}
          />
        </label>
        <label>
          Duplicate emails
          <select
            aria-label="Duplicate email policy"
            value={spec.dedupe?.keep ?? "first"}
            onChange={(e) =>
              onChange({
                ...spec,
                dedupe: {
                  targetField: "email",
                  keep: e.target.value as "first" | "none",
                },
              })
            }
          >
            <option value="first">Keep first accepted record</option>
            <option value="none">Quarantine every duplicate</option>
          </select>
        </label>
      </div>
      {spec.mappings.map((mapping, index) => {
        const change = (next: typeof mapping) =>
          onChange({
            ...spec,
            mappings: spec.mappings.map((m, i) => (i === index ? next : m)),
          });
        return (
          <details className="editable-mapping" key={mapping.targetField}>
            <summary>
              <code>{mapping.targetField}</code>
              <span>
                {mapping.sources.join(" + ") || "Constant"} ·{" "}
                {mapping.steps.length} steps
              </span>
            </summary>
            <div className="editable-body">
              <label>
                Source fields
                <select
                  aria-label={`Source for ${mapping.targetField}`}
                  multiple
                  value={mapping.sources}
                  onChange={(e) =>
                    change({
                      ...mapping,
                      sources: Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      ).slice(0, 3),
                    })
                  }
                >
                  {sourceFields.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <small>
                  Select up to three. Use concat first for multiple sources;
                  constant first when there is no source.
                </small>
                <button
                  className="text-link"
                  onClick={() => change({ ...mapping, sources: [] })}
                >
                  Use no source (constant)
                </button>
              </label>
              <div className="editable-steps">
                {mapping.steps.map((step, stepIndex) => (
                  <div
                    className="editable-step"
                    key={`${stepIndex}:${step.op}`}
                  >
                    <div className="step-header">
                      <span className="document-ref">
                        {String(stepIndex + 1).padStart(2, "0")}
                      </span>
                      <select
                        aria-label={`Transform ${stepIndex + 1} for ${mapping.targetField}`}
                        value={step.op}
                        onChange={(e) =>
                          change({
                            ...mapping,
                            steps: mapping.steps.map((s, i) =>
                              i === stepIndex ? defaultStep(e.target.value) : s,
                            ),
                          })
                        }
                      >
                        {Object.entries(CATALOG).map(([op, info]) => (
                          <option key={op} value={op}>
                            {op} · {info.description}
                          </option>
                        ))}
                      </select>
                      <button
                        className="icon-button"
                        disabled={stepIndex === 0}
                        aria-label={`Move step ${stepIndex + 1} up`}
                        onClick={() => {
                          const steps = [...mapping.steps];
                          [steps[stepIndex - 1], steps[stepIndex]] = [
                            steps[stepIndex]!,
                            steps[stepIndex - 1]!,
                          ];
                          change({ ...mapping, steps });
                        }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={stepIndex === mapping.steps.length - 1}
                        aria-label={`Move step ${stepIndex + 1} down`}
                        onClick={() => {
                          const steps = [...mapping.steps];
                          [steps[stepIndex + 1], steps[stepIndex]] = [
                            steps[stepIndex]!,
                            steps[stepIndex + 1]!,
                          ];
                          change({ ...mapping, steps });
                        }}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove step ${stepIndex + 1} from ${mapping.targetField}`}
                        onClick={() =>
                          change({
                            ...mapping,
                            steps: mapping.steps.filter(
                              (_, i) => i !== stepIndex,
                            ),
                          })
                        }
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <StepParams
                      step={step}
                      onChange={(next) =>
                        change({
                          ...mapping,
                          steps: mapping.steps.map((s, i) =>
                            i === stepIndex ? next : s,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <button
                  className="button secondary small"
                  disabled={mapping.steps.length >= 8}
                  onClick={() =>
                    change({
                      ...mapping,
                      steps: [...mapping.steps, { op: "trim" }],
                    })
                  }
                >
                  <Plus size={13} />
                  Add transformation
                </button>
              </div>
            </div>
          </details>
        );
      })}
      <div className="drop-decisions">
        <h3>Source fields explicitly omitted</h3>
        {spec.unmappedSourceFields.map((drop, index) => (
          <label key={drop.field}>
            <code>{drop.field}</code>
            <input
              aria-label={`Reason for dropping ${drop.field}`}
              value={drop.reason}
              onChange={(e) =>
                onChange({
                  ...spec,
                  unmappedSourceFields: spec.unmappedSourceFields.map((d, i) =>
                    i === index ? { ...d, reason: e.target.value } : d,
                  ),
                })
              }
              maxLength={300}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
