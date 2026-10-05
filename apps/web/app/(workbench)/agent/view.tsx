"use client";
import Link from "next/link";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { Questions } from "@/components/workbench/questions";
import { useWorkbench } from "@/components/workbench/context";
import { Box, Empty, Mark, Sheet, words } from "@/components/workbench/ui";

export function Agent() {
  const wb = useWorkbench();
  const { state, plan, answers } = wb;
  const session = plan
    ? state.sessions.find((s) => s.id === plan.agentSessionId)
    : state.sessions[0];
  const answered = plan
    ? plan.proposal.questions.filter((q) => answers[q.id]).length
    : 0;
  return (
    <>
      {plan && (
        <div className="planner-context">
          <div>
            <strong>Test questions · plan version {plan.version}</strong>
            <span>
              Saved by {plan.authorName}. You're working on this version's
              decisions.
            </span>
          </div>
          <Link href="/tests" className="text-link">
            Browse previous tests <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
      <div className="form-grid three standalone">
        <Box label="AI model">
          <span className="value-strong">
            {state.provider === "groq"
              ? "Groq · gpt-oss-120b"
              : "Offline planner"}
          </span>
          <small>Reads and tests data. Cannot change anything.</small>
        </Box>
        <Box label="This plan’s AI checks">
          {session ? (
            <Mark status={session.status} />
          ) : (
            <span className="value-strong">Not started</span>
          )}
          <small>
            {session
              ? `${session.calls.length} checks`
              : plan
                ? "Earlier inspection"
                : "Start a new test above"}
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
        <Sheet title="Questions for you" id="decisions-heading">
          <Questions />
        </Sheet>
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
              title={plan ? "Earlier inspection" : "No AI run yet"}
              description={
                plan
                  ? "Detailed tool logs are shown for the five most recent AI sessions. This version’s saved questions and proposal remain available in this test."
                  : "The AI reads the data and tests each field before it suggests a plan."
              }
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
