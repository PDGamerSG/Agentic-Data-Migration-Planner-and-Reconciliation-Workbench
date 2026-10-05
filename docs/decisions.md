# Implementation decisions

| Decision                               | Reason                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| One Next.js app                        | UI and validated server services deploy together on Vercel.                                                               |
| PostgreSQL / Neon                      | Staging, plans, evidence and mock target have durable transactional persistence.                                          |
| Prisma workbench models + SQL target   | Typed application storage with explicit destination constraints and lineage operations.                                   |
| JSON snapshots for source and evidence | The 1,000-record cap makes full immutable snapshots practical and keeps the proof attached to the exact run.              |
| Transaction-scoped advisory locks      | Compatible with pooled Neon connections; no reliance on session-pinned locks.                                             |
| Code-defined mandatory risks           | A model cannot suppress approval conditions.                                                                              |
| Offline planner                        | A keyless demo exercises the real tools and complete lifecycle. It is clearly labeled and makes no model-reasoning claim. |
| Re-send on retry                       | Database uniqueness, rather than a remembered checkpoint, prevents duplicate insertion.                                   |
| Refuse rollback on content drift       | Avoid deleting edits made after migration.                                                                                |
| Open shared demo, no sign-in           | Lets the team open the demo link directly; operator names remain labels rather than authenticated user identities.        |
| Declaration layout, CSS and Lucide     | Numbered fields, lifecycle stamps and per-record evidence make the migration's state visible.                             |

Changes from the original design: source records and run evidence are JSON snapshots rather than normalized per-record tables; rollback blocks on content drift; the UI includes a structured mapping editor and an optional JSON editor; the ingestion scope is the committed fixture. Audit writes are mandatory for critical lifecycle changes. The redesigned interface adds persistent light/dark themes and an interactive record map. There is no automatic destructive reset, uploader or production connector. [DESIGN.md](../DESIGN.md) documents the interface and its verification.

The Groq network path is verified with a live key, including a validated proposal, and with injected responses covering invalid calls and bounded rate-limit retries. End-to-end checks use the deterministic offline provider. Neon is prepared; Vercel application deployment awaits the user's environment configuration.
