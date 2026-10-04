# Neon and Vercel deployment

## Neon

Create one dedicated Neon project and database for this demo. Both the workbench tables (`public`) and the mock customer registry (`target`) live there.

Store these values in the ignored root `.env` for local operations, and as Vercel environment variables:

| Variable                | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`          | Neon pooled PostgreSQL connection string, with SSL required      |
| `DIRECT_URL`            | Neon direct connection string for migration commands             |
| `APP_ACCESS_CODE`       | Strong shared code for opening the public workbench              |
| `SESSION_SECRET`        | Random secret of at least 32 characters for signed sessions      |
| `GROQ_API_KEY`          | Optional model-backed planning; omit for the offline planner     |
| `GROQ_MODEL`            | Optional; defaults to `openai/gpt-oss-120b`                      |
| `ALLOW_FAULT_INJECTION` | `true` to demonstrate interruption and retry; otherwise disabled |

Generate a session secret locally with `openssl rand -hex 32`. Keep it out of source control and browser-visible environment variables. No `NEXT_PUBLIC_*` secret is needed.

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

Vercel deployments refuse access if `APP_ACCESS_CODE` is missing. Signed session cookies are HttpOnly and SameSite=Strict. The authentication endpoint also validates the request origin.

Deploy after database preparation. Open the deployed URL, enter the access code, and complete the demo flow. API actions run in Node.js with a 60-second route budget. Agent network requests have a 48-second budget; a killed execution can be safely retried after its two-minute reservation expires.

## GitHub database workflow

The `Prepare Neon database` workflow is manually dispatched. Add `DATABASE_URL` and `DIRECT_URL` as secrets in the `production` GitHub environment to use it. It generates Prisma, deploys migrations and seeds only if empty. CI uses its own disposable local PostgreSQL service and never touches Neon.

The Vercel Git integration deploys application changes. Production database migrations remain a separate explicit deployment step.

## Verification

- `/api/health` returns an operational HTTP response; it does not prove database readiness.
- After signing in, open the overview and verify 250 staged records and 20 baseline target rows on a fresh database.
- Draft, answer, dry-run, approve, execute, retry, reconcile and roll back.
- Confirm all five count checks match and rollback leaves the 20 pre-existing rows.
- Confirm an unauthenticated API request is rejected and an approved version cannot be edited in place.

There is no live deployment URL yet. Account credentials will be supplied separately.
