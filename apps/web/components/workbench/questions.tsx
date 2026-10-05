"use client";
import { useWorkbench } from "./context";
import { Empty } from "./ui";

const guidance: Record<
  string,
  { field: string; example: string; options: Record<string, string> }
> = {
  date_order: {
    field: "signup_dt → created_at",
    example:
      "Slash dates can swap the month and day. Confirm the convention used by the source system.",
    options: {
      "MM/DD/YYYY": "04/05/2021 → April 5, 2021",
      "DD/MM/YYYY": "04/05/2021 → May 4, 2021",
    },
  },
  unknown_status: {
    field: "status_cd → status",
    example:
      "The source value X has no documented meaning. Choose a policy only if the business can support it.",
    options: {
      reject: "Hold these records for review; do not load them.",
      inactive: "Convert X to inactive in the target.",
      suspended: "Convert X to suspended in the target.",
    },
  },
  missing_credit: {
    field: "credit_limit → credit_limit_cents",
    example:
      "N/A is missing financial information. Zero means no credit, which may be different from an unknown limit.",
    options: {
      reject: "Hold records with N/A credit for review.",
      zero: "Store N/A credit as 0 cents in the target.",
    },
  },
  marketing: {
    field: "New target field: marketing_opt_in",
    example:
      "There is no consent field in the source. Migrating a customer does not grant marketing permission.",
    options: {
      confirmed: "Set marketing_opt_in to false for every migrated record.",
    },
  },
  notes: {
    field: "Source-only field: notes",
    example:
      "The target has nowhere to store legacy notes. Review the source data before accepting this omission.",
    options: {
      confirmed:
        "Omit notes from the target. Original source records remain available.",
    },
  },
  login_ip: {
    field: "Source-only field: last_login_ip",
    example:
      "Login IP history has no destination in the new customer table. It will not appear in migrated records.",
    options: {
      confirmed:
        "Omit login IPs from the target. Original source records remain available.",
    },
  },
  duplicates: {
    field: "email_addr → email",
    example:
      "After trimming and lowercasing, two source customers may have the same email. The target accepts only unique emails.",
    options: {
      first: "Keep the first valid source record; hold later duplicates.",
      none: "Hold every source record sharing a duplicate email; do not choose a winner.",
    },
  },
};

export function Questions() {
  const wb = useWorkbench();
  const { plan, answers, setAnswers } = wb;
  if (!plan)
    return (
      <Empty
        title="No questions yet"
        description="Enter your name and choose New test. The planner will inspect the demo dataset and ask for the decisions it needs."
      />
    );
  if (!plan.proposal.questions.length)
    return (
      <Empty
        title="No business questions for this version"
        description="Review the suggested plan and run a dry run to inspect the record results."
      />
    );
  const answered = plan.proposal.questions.filter((q) => answers[q.id]).length;
  return (
    <div className="decisions">
      <div className="questions-intro">
        <p>
          Decide how unclear or missing data should be treated. These answers
          shape the next plan; a dry run will show the affected records.
        </p>
        <div>
          <strong>
            {answered} of {plan.proposal.questions.length} answered
          </strong>
          <span>Required decisions must be saved before approval.</span>
        </div>
        <progress
          aria-label="Questions answered"
          max={plan.proposal.questions.length}
          value={answered}
        />
      </div>
      {plan.proposal.questions.map((q, i) => {
        const help = guidance[q.id];
        const inputId = `question-${q.id}`;
        return (
          <div
            key={q.id}
            className={`decision ${answers[q.id] ? "answered" : ""}`}
          >
            <span className="decision-no mono">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="decision-text">
              <div className="question-meta">
                <code>{help?.field ?? q.id}</code>
                <span>
                  {q.blocking ? "Required before approval" : "Optional"}
                </span>
              </div>
              <label htmlFor={inputId}>
                <strong>{q.question}</strong>
              </label>
              <p id={`${inputId}-why`}>
                {q.why} {help?.example}
              </p>
            </div>
            {help && (
              <dl className="answer-guide" id={`${inputId}-choices`}>
                {q.options.map((option) => (
                  <div key={option}>
                    <dt>
                      {option === "confirmed"
                        ? "Confirm omission / default"
                        : option === "reject"
                          ? "Hold for review"
                          : option === "zero"
                            ? "Use zero"
                            : option === "first"
                              ? "Keep first valid record"
                              : option === "none"
                                ? "Hold all duplicates"
                                : option}
                    </dt>
                    <dd>{help.options[option] ?? option}</dd>
                  </div>
                ))}
              </dl>
            )}
            <select
              id={inputId}
              aria-describedby={`${inputId}-why${help ? ` ${inputId}-choices` : ""}`}
              value={answers[q.id] ?? ""}
              onChange={(e) =>
                setAnswers((a) => {
                  const next = { ...a };
                  if (e.target.value) next[q.id] = e.target.value;
                  else delete next[q.id];
                  return next;
                })
              }
            >
              <option value="">Choose an answer…</option>
              {q.options.map((option) => (
                <option key={option} value={option}>
                  {option === "confirmed"
                    ? "I confirm this decision"
                    : option === "reject"
                      ? "Hold for review"
                      : option === "zero"
                        ? "Use zero (0 cents)"
                        : option === "first"
                          ? "Keep first valid record"
                          : option === "none"
                            ? "Hold all duplicates"
                            : option}
                </option>
              ))}
            </select>
            {answers[q.id] && (
              <small className="answer-state">
                {answers[q.id] === plan.answers[q.id]
                  ? `Saved in version ${plan.version}`
                  : "Selected · save with Update plan with answers"}
              </small>
            )}
          </div>
        );
      })}
      <div className="decisions-foot">
        <button
          className="button primary full"
          onClick={wb.draft}
          disabled={!!wb.busy || wb.runningSession || !wb.actor.trim()}
        >
          Update plan with answers
        </button>
        <p>
          Saves a new version attributed to {wb.actor.trim() || "your name"}.
          This version and its earlier results stay available.
        </p>
      </div>
    </div>
  );
}
