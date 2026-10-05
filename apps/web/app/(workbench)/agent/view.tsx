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
      <div className="form-grid four standalone">
        <Box n={1} label="Planner">
          <span className="value-strong">
            {state.provider === "groq"
              ? "Groq · gpt-oss-120b"
              : "Offline planner"}
          </span>
          <small>
            {state.provider === "groq"
              ? "Model-driven proposals, independently re-tested"
              : "Deterministic demo planner. Add a Groq key for model proposals."}
          </small>
        </Box>
        <Box n={2} label="Capabilities">
          <span className="value-strong">Read-only tools</span>
          <small>
            Inspect, profile and test. It cannot write, approve or load.
          </small>
        </Box>
        <Box n={3} label="Latest session">
          {session ? (
            <Mark status={session.status} />
          ) : (
            <span className="value-strong">None yet</span>
          )}
          <small>
            {session
              ? `${session.calls.length} tool calls logged`
              : "Start the agent to inspect"}
          </small>
        </Box>
        <Box n={4} label="Decisions">
          <span className="figure">
            {answered}
            <small> / {plan?.proposal.questions.length ?? 0}</small>
          </span>
          <small>Answered by the operator</small>
        </Box>
      </div>

      <div className="split agent-split">
        <Sheet
          title="Inspection log"
          id="log-heading"
          meta={
            session ? (
              <span className="mono">{session.calls.length} calls</span>
            ) : undefined
          }
        >
          {!session ? (
            <Empty
              title="A proposal starts with evidence."
              description="The agent reads both schemas, profiles every field and tests each mapping against the staged records before it proposes anything."
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
                  Inspecting and testing…
                </li>
              )}
              {session.error && <li className="tool-error">{session.error}</li>}
            </ol>
          )}
        </Sheet>

        <Sheet
          title="Business decisions"
          id="decisions-heading"
          meta={<span>Operator input</span>}
        >
          {!plan ? (
            <Empty
              title="Questions appear here."
              description="The agent flags every choice it cannot safely infer from the data, such as ambiguous dates or consent defaults."
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
                  Re-draft with answers
                </button>
                <p>Answers are written into a new immutable plan version.</p>
              </div>
            </div>
          )}
        </Sheet>
      </div>

      {plan && (
        <Sheet
          title="Proposed migration"
          id="proposal-heading"
          meta={
            <Link href={`/plans/${plan.id}`} className="text-link">
              Review v{plan.version}
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
                    <th scope="col">Finding</th>
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
