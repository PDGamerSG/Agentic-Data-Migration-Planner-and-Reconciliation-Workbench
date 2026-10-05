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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
