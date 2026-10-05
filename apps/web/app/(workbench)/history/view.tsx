"use client";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useWorkbench } from "@/components/workbench/context";
import { Mark, Sheet, time, words } from "@/components/workbench/ui";

type Event = ReturnType<typeof useWorkbench>["state"]["history"][number];
type Row =
  | { kind: "event"; event: Event }
  | { kind: "batch"; type: string; events: Event[] };

/** Groups events into the lifecycle family they belong to, so the register reads like a ledger. */
function family(type: string) {
  if (type.startsWith("agent")) return "agent";
  if (type.includes("approv")) return "approval";
  if (type.includes("rollback")) return "rollback";
  if (type.includes("retry") || type.includes("failed")) return "retry";
  if (type.startsWith("execution") || type.includes("reconcil"))
    return "execution";
  if (type.includes("dry_run")) return "inspection";
  if (type.includes("plan")) return "plan";
  return "system";
}

/** Repetitive events (tool calls, committed batches) fold into one expandable row per run of them. */
const FOLDED = new Set(["agent_tool_called", "execution_batch_committed"]);

function fold(events: Event[]): Row[] {
  const rows: Row[] = [];
  for (const event of events) {
    const last = rows.at(-1);
    if (
      FOLDED.has(event.type) &&
      last?.kind === "batch" &&
      last.type === event.type
    )
      last.events.push(event);
    else if (FOLDED.has(event.type))
      rows.push({ kind: "batch", type: event.type, events: [event] });
    else rows.push({ kind: "event", event });
  }
  return rows.map((r) =>
    r.kind === "batch" && r.events.length === 1
      ? { kind: "event", event: r.events[0]! }
      : r,
  );
}

function Entry({ event }: { event: Event }) {
  return (
    <details>
      <summary>
        <span className="entry-no mono">#{event.id}</span>
        <time
          className="mono"
          dateTime={new Date(event.createdAt).toISOString()}
        >
          {time(event.createdAt)}
        </time>
        <span className="entry-family">{family(event.type)}</span>
        <strong>{words(event.type)}</strong>
        <span className="entry-actor">{event.actor}</span>
        <ChevronDown size={15} aria-hidden="true" className="entry-chevron" />
      </summary>
      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
    </details>
  );
}

export function History() {
  const { state } = useWorkbench();
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState("");
  const events = state.history.filter(
    (e) =>
      (!kind || family(e.type) === kind) &&
      `${e.type} ${e.actor}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const rows = fold(events);
  const families = [
    "plan",
    "agent",
    "inspection",
    "approval",
    "execution",
    "retry",
    "rollback",
  ];
  return (
    <Sheet
      title="Activity register"
      id="register-heading"
      meta={<Mark status="succeeded" label="append-only" />}
    >
      <p className="sheet-intro">
        Database rules refuse any update or delete on these events. The latest{" "}
        {state.history.length} are shown; repeated tool calls and committed
        batches are folded.
      </p>
      <div
        className="quarantine-codes"
        role="group"
        aria-label="Filter by activity"
      >
        <button
          type="button"
          className={`code-filter ${kind === "" ? "active" : ""}`}
          aria-pressed={kind === ""}
          onClick={() => setKind("")}
        >
          All
        </button>
        {families.map((f) => (
          <button
            type="button"
            key={f}
            className={`code-filter ${kind === f ? "active" : ""}`}
            aria-pressed={kind === f}
            onClick={() => setKind(kind === f ? "" : f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={15} aria-hidden="true" />
          <input
            placeholder="Filter by event or operator"
            aria-label="Filter history"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <ol className="register">
        {rows.map((row) =>
          row.kind === "event" ? (
            <li
              key={row.event.id}
              className={`entry ${family(row.event.type)}`}
            >
              <Entry event={row.event} />
            </li>
          ) : (
            <li
              key={`batch-${row.events[0]!.id}`}
              className={`entry folded ${family(row.type)}`}
            >
              <details>
                <summary>
                  <span className="entry-no mono">
                    #{row.events.at(-1)!.id}–{row.events[0]!.id}
                  </span>
                  <time
                    className="mono"
                    dateTime={new Date(row.events[0]!.createdAt).toISOString()}
                  >
                    {time(row.events[0]!.createdAt)}
                  </time>
                  <span className="entry-family">{family(row.type)}</span>
                  <strong>
                    {words(row.type)}{" "}
                    <span className="entry-times">× {row.events.length}</span>
                  </strong>
                  <span className="entry-actor">{row.events[0]!.actor}</span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className="entry-chevron"
                  />
                </summary>
                <ol className="register nested">
                  {row.events.map((event) => (
                    <li
                      key={event.id}
                      className={`entry ${family(event.type)}`}
                    >
                      <Entry event={event} />
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ),
        )}
        {!rows.length && (
          <li className="entry-empty">No events match this filter.</li>
        )}
      </ol>
    </Sheet>
  );
}
