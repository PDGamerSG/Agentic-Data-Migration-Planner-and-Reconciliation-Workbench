# Agent-assisted development

## Tools and responsibility

Codex assisted with implementation, debugging, interface refinement, documentation and verification. The workflow used Git/GitHub CLI, pnpm, TypeScript, Prisma, PostgreSQL, Vitest, Playwright and the T3 Code collaborative browser. Frontend work also used the frontend-design and Impeccable skills. Development assistance is separate from Manifest's runtime planner, which uses Groq and a closed tool registry.

The repository is the reviewable output. An agent's claim that a change worked was not accepted as verification: source changes, automated checks and rendered behavior were inspected. The developer remains responsible for understanding the implementation and operating the deployment.

## Representative prompts

These examples summarize the development instructions; they are not a complete transcript and contain no private task material.

- Keep transformation and dry-run decisions pure, use only supported catalog operations, and persist immutable plan versions with evidence.
- Verify that interrupted execution can resume without duplicates and rollback cannot remove pre-existing or subsequently edited target rows.
- Improve the interface using Linear navigation and Supabase data controls while preserving the migration lifecycle.
- Move the operator controls to the bottom and keep the final content accessible on mobile.
- Refine dark-mode colors, contrast and fonts, then inspect desktop and mobile rendering.
- Review the built interface independently and update the design system from the implemented CSS rather than design intentions.

## Delegated work

During the interface refinements, separate Impeccable reviewer and documenter agents worked on bounded tasks. The reviewer inspected supplied screenshots and representative source files without browser access or edits. The documenter updated DESIGN.md and its design sidecars from the implemented tokens and fonts. Their findings and changes were inspected by the main development agent. They did not receive deployment credentials or perform deployment actions.

The submission-readiness pass was handled by the main agent. It checked repository documentation, hosting, CI and the model-backed workflow.

The follow-up readiness pass reran the production build and all local checks, including the seven PostgreSQL lifecycle tests and 21 browser tests against the dedicated local test database. It corrected the product document's ambiguous offline-fallback description and prepared a separate sanitized copy of Git history for review. After user approval, the latest GitHub history was fetched before publication. The cleanup replaces the historical private plan with the product-only roadmap and verifies that current application files are preserved; existing clones must resync because commit IDs change.

## Mistakes, corrections and rejected behavior

- An early implementation plan retained private source material and was mistakenly committed. The current plan was replaced with a product-only implementation roadmap, and the follow-up cleanup also replaces the historical plan in every reachable commit. Git integrity and current-tree comparisons verify the sanitized history. This does not control copies or cached objects retained outside the repository's reachable history.
- The original compressed typography and flat dark palette did not satisfy the user's visual expectations. Manrope and JetBrains Mono replaced the stretched fonts; action fills, text accents and record fills now use separate semantic colors. Desktop/mobile captures and measured contrast verified the correction.
- A browser test selected business answers before the new planner version was ready. It now waits for that version's route; input values are captured before state updates and selects are disabled while planning.
- The embedded PostgreSQL launcher failed on the Windows development machine. Verification used the installed PostgreSQL binaries to start the same local database, without substituting an in-memory store.
- Model calls returned HTTP 400/413 and rate-limit errors. The model workflow bounds request time and retries, compacts inspection context, validates tool responses and records failed sessions. The hosted readiness check reproduced HTTP 400. A focused recovery now permits one handoff when Groq reports `tool_use_failed`: the application validates returned calls itself and rejects every model tool except `submit_proposal`. Injected tests cover successful recovery, hidden-tool rejection and repeated failure. Failed model calls are not presented as completed proposals, and provider-generated failed content is not copied into retry prompts.
- Arbitrary code transforms, unknown tools and model attempts to omit mandatory approval risks are rejected by code and tests. These are enforced boundaries, not discretionary model instructions.
- Deployment documentation became stale after the hosted site was configured. The submission pass checked the real deployment and corrected the docs rather than relying on those old claims.

## Verification

The checks cover formatting, lint, strict typechecking, unit tests, real PostgreSQL lifecycle tests, a production build and browser tests. CI provisions its own PostgreSQL service. Browser lifecycle checks use the deterministic planner for reproducibility; provider-response tests exercise the model loop, invalid calls and rate-limit handling. A hosted smoke test separately checks the configured Groq path.

Important verified behaviors include plan hashing and deterministic dry runs; human approval tied to exact persisted evidence; immutable versions; transactional audit writes; duplicate-free interrupted retry; reconciliation; rollback ownership/content checks; malformed and cross-origin request rejection; responsive navigation; keyboard record inspection; and theme persistence/contrast.

For commands and the most recent check results, see [README.md](README.md). Persisted application audit events and AI tool calls are visible in the workbench. Hosting logs contain request metadata, without credentials or source payloads. [Architecture](docs/architecture.md) explains the boundaries and [the demo script](docs/demo-script.md) provides a reproducible review path.
