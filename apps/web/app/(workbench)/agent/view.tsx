"use client";
import Link from "next/link";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useWorkbench } from "@/components/workbench/context";
import { Box, Empty, Mark, Sheet, words } from "@/components/workbench/ui";

export function Agent() {
  const wb = useWorkbench();
  const { state, plan, answers, setAnswers } = wb;
  const session = state.sessions[0];
  const answered = plan
    ? plan.proposal.questions.filter((q) => answers[q.id]).length
    : 0;
  return (
    <>
      <div className="form-grid three standalone">
        <Box label="AI model">
          <span className="value-strong">
            {state.provider === "groq"
              ? "Groq · gpt-oss-120b"
              : "Offline planner"}
          </span>
          <small>Reads and tests data. Cannot change anything.</small>
        </Box>
        <Box label="Last run">
          {session ? (
            <Mark status={session.status} />
          ) : (
            <span className="value-strong">Not started</span>
          )}
          <small>
            {session ? `${session.calls.length} checks` : "Start it above"}
          </small>
        </Box>
        <Box label="Questions answered">
          <span className="figure">
            {answered}
            <small> / {plan?.proposal.questions.length ?? 0}</small>
          </span>
        </Box>
      </div>

      <div className="split agent-split">
        <Sheet
          title="What the AI checked"
          id="log-heading"
          meta={
            session ? (
              <span className="mono">{session.calls.length} checks</span>
            ) : undefined
          }
        >
          {!session ? (
            <Empty
              title="No AI run yet"
              description="The AI reads the data and tests each field before it suggests a plan."
            />
          ) : (
            <ol className="tool-log">
              {session.calls.map((c) => (
                <li key={c.id}>
                  <details>
                    <summary>
                      <span className="tool-seq mono">
                        {String(c.seq).padStart(2, "0")}
                      </span>
                      {c.rejected ? (
                        <X
                          size={14}
                          className="tool-rejected"
                          aria-label="rejected"
                        />
                      ) : (
                        <Check
                          size={14}
                          className="tool-ok"
                          aria-label="completed"
                        />
                      )}
                      <code>{c.tool}</code>
                      <span className="tool-arg mono">
                        {typeof c.args === "object" &&
                          c.args !== null &&
                          "field" in c.args &&
                          String((c.args as { field: unknown }).field)}
                      </span>
                      <span className="tool-time mono">{c.durationMs} ms</span>
                    </summary>
                    <div className="tool-detail">
                      <span className="box-label">Arguments</span>
                      <pre>{JSON.stringify(c.args, null, 2)}</pre>
                      <span className="box-label">Result</span>
                      <pre>{JSON.stringify(c.result, null, 2)}</pre>
                    </div>
                  </details>
                </li>
              ))}
              {session.status === "running" && (
                <li className="tool-running" role="status">
                  <Loader2 size={15} className="spin" aria-hidden="true" />
                  Checking the data…
                </li>
              )}
              {session.error && <li className="tool-error">{session.error}</li>}
            </ol>
          )}
        </Sheet>

        <Sheet title="Questions for you" id="decisions-heading">
          {!plan ? (
            <Empty
              title="No questions yet"
              description="The AI asks when the data alone can't decide, such as an unclear date format."
            />
          ) : (
            <div className="decisions">
              {plan.proposal.questions.map((q, i) => (
                <label
                  key={q.id}
                  className={`decision ${answers[q.id] ? "answered" : ""}`}
                >
                  <span className="decision-no mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="decision-text">
                    <strong>{q.question}</strong>
                    <small>{q.why}</small>
                  </span>
                  <select
                    aria-label={q.question}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                    }
                  >
                    <option value="">Choose…</option>
                    {q.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <div className="decisions-foot">
                <button
                  className="button primary full"
                  onClick={wb.draft}
                  disabled={!!wb.busy || wb.runningSession}
                >
                  Update plan with answers
                </button>
                <p>Saves a new plan version.</p>
              </div>
            </div>
          )}
        </Sheet>
      </div>

      {plan && (
        <Sheet
          title="Suggested plan"
          id="proposal-heading"
          meta={
            <Link href={`/plans/${plan.id}`} className="text-link">
              Open version {plan.version}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          <p className="proposal-summary">{plan.proposal.summary}</p>
          {plan.proposal.incompatibilities.length > 0 && (
            <div className="table-scroll">
              <table className="ledger-table remarks">
                <caption className="sr-only">
                  Incompatible or missing fields
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Issue</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.proposal.incompatibilities.map((i, index) => (
                    <tr key={index}>
                      <td>
                        <code>{i.field}</code>
                      </td>
                      <td>
                        <span className="code-chip">{words(i.kind)}</span>
                      </td>
                      <td>{i.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
