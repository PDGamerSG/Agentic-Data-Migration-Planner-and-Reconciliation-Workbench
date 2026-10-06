# Neon and Vercel deployment

## Neon

Create one dedicated Neon project and database for this demo. Both the workbench tables (`public`) and the mock customer registry (`target`) live there.

Store these values in the ignored root `.env` for local operations, and as Vercel environment variables:

| Variable                | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon pooled PostgreSQL connection string, with SSL required                        |
| `DIRECT_URL`            | Neon direct connection string for migration commands                               |
| `GROQ_API_KEY`          | Required for a model-backed hosted demo; omit only for offline development/CI      |
| `GROQ_API_KEYS`         | Optional extra Groq keys, comma-separated; rate-limited keys hand over to the next |
| `GROQ_MODEL`            | Optional; defaults to `openai/gpt-oss-120b`                                        |
| `ALLOW_FAULT_INJECTION` | `true` to demonstrate interruption and retry; otherwise disabled                   |

Keep these values out of source control and browser-visible environment variables. No `NEXT_PUBLIC_*` secret is needed.

Apply the schema and fixtures:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

Migrations are committed. `db:seed` only initializes an empty workbench; it refuses a populated target without a dataset. It never overwrites plans, audit history, or customer rows.

## Vercel

Import `PDGamerSG/Agentic-Data-Migration-Planner-and-Reconciliation-Workbench` into Vercel.

- Framework: Next.js.
- Root directory: **`apps/web`**.
- Allow access to files outside the root directory so workspace packages can be built.
- Node.js: **22.x**.
- `apps/web/vercel.json` sets workspace installation and build commands.
- Add the environment variables above before deploying.

The deployed workbench is open: anyone with the URL can view it and run actions. API mutations validate the request origin.

Deploy after database preparation. Open the deployed URL and complete the demo flow. API actions run in Node.js with a 60-second route budget. Agent inspections and model requests share a 48-second budget; a killed execution can be safely retried after its two-minute reservation expires.

Each model request, including response-body delivery, has a 12-second timeout. Stalled connections and temporary provider outages permit up to three attempts with short delays and key rotation. Rate-limit waits are accepted only when they leave time for a complete model response. Caller cancellation and the total session budget stop retries; failures never substitute an offline proposal.

## GitHub database workflow

The `Prepare Neon database` workflow is manually dispatched. Add `DATABASE_URL` and `DIRECT_URL` as secrets in the `production` GitHub environment to use it. It generates Prisma, deploys migrations and seeds only if empty. CI uses its own disposable local PostgreSQL service and never touches Neon.

The Vercel Git integration deploys application changes. Production database migrations remain a separate explicit deployment step.

## Clear demo test history

For an explicitly authorized demo cleanup, connect an administrative shell to the intended database and run:

```sh
pnpm --filter @manifest/db db:reset-demo --confirm-reset-demo
```

This removes plans, approvals, runs, planner sessions, tool calls, reconciliations and rollback history. It retains the 250 synthetic source records and the unchanged 20 seeded target customers, and records one reset event. The command refuses a different dataset, active sessions, active runs, migrated target rows or changed baseline customers. Roll back loaded migrations through the application first. The reset and its audit event commit together, and normal immutable-history protections remain enabled. There is no public reset control in the application.

## Verification

- `/api/health` returns an operational HTTP response; it does not prove database readiness.
- Open the overview without signing in and verify 250 staged records and 20 baseline target rows on a fresh database.
- Draft, answer, dry-run, approve, execute, retry, reconcile and roll back.
- Confirm all five count checks match and rollback leaves the 20 pre-existing rows.
- Confirm mutations from a different Origin are rejected and an approved version cannot be edited in place. The demo intentionally allows same-origin access without authentication.

The deployed application is available at [agenticmigrator.vercel.app](https://agenticmigrator.vercel.app). Neon provides persistence, Groq is the configured planner, and no test-account credentials are required. Repository-linked Vercel deployments update the application after pushes to main; check the deployment status before sharing the URL.
