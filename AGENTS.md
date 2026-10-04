# Project conventions

Manifest is a bounded migration workbench, not a general database connector.

- Preserve the one-source, one-target, 1,000-record limit.
- Keep transforms and dry-run decisions in `packages/core` without database or network access.
- Only the closed transform catalog may be used; never evaluate arbitrary code.
- Plans and approvals are immutable. Edits create new versions.
- Approval binds to the exact plan hash and a persisted dry-run result.
- Keep critical audit writes in the same transaction as state changes.
- Do not change retry lineage, unique target keys, or rollback ownership rules without lifecycle tests.
- Store money in integer cents and normalize target timestamps to UTC.
- For Next.js changes, read the relevant locally installed documentation under `apps/web/node_modules/next/dist/docs`.
- Run formatting, lint, typecheck, unit tests, and the affected PostgreSQL/browser checks.
- Commit focused changes with descriptive conventional commit messages. Do not add attribution trailers.
