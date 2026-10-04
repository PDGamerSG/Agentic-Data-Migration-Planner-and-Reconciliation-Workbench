# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences carry equal weight:

- **Assignment reviewers** at Aggroso evaluate an "Expert" take-home brief by clicking through the live deployment for a few minutes. They need to see the whole lifecycle (inspect → agent proposal → human decisions → versioned plan → dry run → approval → execution → interrupted retry → reconciliation → rollback → history) and verify each requirement without reading the code.
- **Data engineers or migration operators** are the people the tool pretends to serve. They move one bounded legacy dataset into a strict target, and they need dense, trustworthy evidence: counts, field-level errors, hashes, versions and an audit trail.

## Product Purpose

Manifest plans and validates a controlled migration of one bounded dataset. The source is a messy legacy CRM export (`legacy_crm.customers`, 250 seeded records, maximum 1,000). The target is a strict customer registry (`target.customers`, which already holds 20 rows). A tool-restricted AI agent proposes mappings, incompatibilities, risks and clarification questions. A human answers the questions, versions and approves an exact plan, and only then can rows be inserted. Success means every source record is accounted for, as either landed or held in quarantine with evidence, a retry never duplicates rows, and the load can be reconciled and rolled back.

## Positioning

The agent proposes and a human signs. The agent can only inspect and test through read-only tools, and every tool call is visible. Approval binds to one plan hash and one persisted dry-run fingerprint. Execution is idempotent in the database, and rollback removes only the rows that this migration owns. The product's claim is the paper trail itself: every record, decision and retry can be traced.

## Operating Context

- Single-operator web workbench. The operator types their name into the header, and that name is recorded on approvals, runs and rollbacks.
- An access code protects the deployed instance (`/login`).
- Data lives in Neon Postgres. The `public` schema holds the workbench and `target` is the mock destination.
- The planner is Groq (`openai/gpt-oss-120b`), with a deterministic offline planner as fallback.
- Interrupting an execution is a demo feature (`ALLOW_FAULT_INJECTION`). It stops the load after a committed batch so the operator can show a retry that skips the rows already loaded.

## Capabilities and Constraints

- Sections: Overview, Schemas & source, Planning agent, Migration plans (version list, mapping editor, diff, approval), Runs & quarantine (dry runs and executions, counts, quarantine with field-level evidence and transform traces), Target & reconciliation (target browser, reconciliation report, rollback), Activity log.
- One source, one target, a 1,000-record limit. Only the closed transformation catalog may be used. Plans and approvals are immutable: edits create new versions.
- Counts vocabulary: source, transformed, accepted, rejected (quarantined). Invariant: accepted + rejected = source.
- Not in scope: production database access, arbitrary transformation code, distributed migration, live cloud connectors, multi-user auth.

## Brand Commitments

- Name: **Manifest** (lower-case wordmark `manifest`), subtitle "Migration workbench".
- Light and dark themes are required, with a toggle.

## Evidence on Hand

- Real seeded data: 250 source records with planted defects, 20 pre-existing target rows, 13 target fields, 17 catalog transforms.
- Real agent sessions and tool traces from Groq or the offline planner.
- There are no customers, testimonials or benchmarks, and none may be invented.

## Product Principles

1. Every record is accounted for. Counts must reconcile, and each held record shows why.
2. The agent proposes and the human decides. Make that boundary visible.
3. Show proof, not claims: hashes, versions and history are first-class content.
4. Make the next step obvious. A first-time reviewer should be able to walk the whole lifecycle without docs.
5. Keep the bounds visible: one source, one target, 1,000 rows.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both themes, full keyboard operation, visible focus, `prefers-reduced-motion` respected, and status never conveyed by color alone.
