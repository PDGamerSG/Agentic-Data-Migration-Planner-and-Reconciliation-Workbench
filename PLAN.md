# Implementation roadmap

Manifest is a bounded migration workbench. This document describes the implementation and remaining product scope; the running application and README are authoritative.

## Shipped workflow

1. Inspect the staged legacy CRM fixture and strict target schema.
2. Use a restricted planner to propose catalog-based mappings and identify business decisions.
3. Record human answers in new immutable plan versions.
4. Persist deterministic dry-run evidence and field-level rejection traces.
5. Approve the exact plan hash and successful dry-run fingerprint.
6. Execute in transactional batches with unique destination keys and migration lineage.
7. Retry interrupted loads without duplicating rows.
8. Reconcile counts, keys, row content and integer credit totals.
9. Roll back only unchanged migration-owned rows, retaining the baseline target.
10. Inspect persisted tool calls and append-only audit events.

## Implementation boundaries

- One source, one target and a maximum of 1,000 staged records.
- Pure deterministic transformation and reconciliation logic in packages/core.
- Closed transform catalog; no arbitrary code or production connectors.
- PostgreSQL persistence, immutable plans/approvals and critical audit writes in the same transaction.
- Human approval before target writes; the planning agent has no execution or approval tool.
- Synthetic fixture ingestion, shared demo access and operator names as attribution labels.

## Verification and documentation

- [README.md](README.md): setup, architecture, deployed access, scope and tests.
- [AGENT_USAGE.md](AGENT_USAGE.md): development tools, representative prompts, mistakes and verification.
- [Architecture](docs/architecture.md): hashes, approval, retry, rollback and audit invariants.
- [Demo walkthrough](docs/demo-script.md): the complete migration lifecycle.
- [Deployment setup](docs/backend-setup.md): hosting, database preparation and environment configuration.
- [Design system](DESIGN.md): the Linear/Supabase workspace, both themes and bottom operator controls.

## Intentionally excluded

Production database access, arbitrary transforms, live cloud connectors, uploads, distributed execution, multi-tenant isolation and authenticated operator identities. These are future product work, not hidden capabilities of the demo.
