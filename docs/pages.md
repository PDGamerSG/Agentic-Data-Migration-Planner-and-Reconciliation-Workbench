# Where to edit each page

Every screen has its own folder in `apps/web/app/(workbench)`.

- `page.tsx` is the route entry: Next.js opens this file for that URL. It sets the browser tab title and renders the screen.
- `view.tsx` contains that screen's content, buttons, tables and local UI state. Start here when changing what a page looks like or does.
- `layout.tsx` wraps all these pages with the shared workbench. The parentheses in `(workbench)` group the files; they do not appear in the URL.

| Screen                  | URL        | Route file                                  | UI file                                     |
| ----------------------- | ---------- | ------------------------------------------- | ------------------------------------------- |
| Overview                | `/`        | `apps/web/app/(workbench)/page.tsx`         | `apps/web/app/(workbench)/view.tsx`         |
| Schemas & source        | `/schemas` | `apps/web/app/(workbench)/schemas/page.tsx` | `apps/web/app/(workbench)/schemas/view.tsx` |
| Planning agent          | `/agent`   | `apps/web/app/(workbench)/agent/page.tsx`   | `apps/web/app/(workbench)/agent/view.tsx`   |
| Migration plans         | `/plans`   | `apps/web/app/(workbench)/plans/page.tsx`   | `apps/web/app/(workbench)/plans/view.tsx`   |
| Runs & quarantine       | `/runs`    | `apps/web/app/(workbench)/runs/page.tsx`    | `apps/web/app/(workbench)/runs/view.tsx`    |
| Target & reconciliation | `/target`  | `apps/web/app/(workbench)/target/page.tsx`  | `apps/web/app/(workbench)/target/view.tsx`  |
| Activity log            | `/history` | `apps/web/app/(workbench)/history/page.tsx` | `apps/web/app/(workbench)/history/view.tsx` |

For example, to change the homepage's Record status section, open `apps/web/app/(workbench)/view.tsx`. To change the source-data table, open `apps/web/app/(workbench)/schemas/view.tsx`.

## Plan and run detail pages

`apps/web/app/(workbench)/plans/[planId]/page.tsx` handles `/plans/<plan ID>`.

`apps/web/app/(workbench)/runs/[runId]/page.tsx` handles `/runs/<run ID>`.

Square brackets mean that part of the URL changes. These detail pages reuse their section's UI. The shared workbench reads the ID from the URL to select the plan or run. This keeps the list and detail screens using the same implementation.

`/overview` also opens the homepage through `apps/web/app/(workbench)/overview/page.tsx`.

## Shared files

| Change                                       | File                                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Sidebar labels, links and icons              | `apps/web/components/workbench/shell.tsx`                   |
| Visible page headings and subtitles          | The `titles` map in `apps/web/components/workbench-app.tsx` |
| Data loading and migration actions           | `apps/web/components/workbench-app.tsx`                     |
| Values and actions available to every screen | `apps/web/components/workbench/context.ts`                  |
| Shared section, button and dialog components | `apps/web/components/workbench/ui.tsx`                      |
| Colors, spacing, typography and phone layout | `apps/web/app/globals.css`                                  |
| API endpoints                                | `apps/web/app/api/[...path]/route.ts`                       |

Pages use `useWorkbench()` to read shared data and call existing actions. For example, `wb.dry()` starts a dry run and `wb.openEvidence(record)` opens a record's inspection report.

Keep migration rules in `packages/core` and database writes in `packages/db`. A page change should call the existing actions rather than duplicate approval, execution or rollback rules.

## Check your edits

Run `pnpm dev` to preview the application. Before committing, run:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Browser coverage in `apps/web/e2e/routing.spec.ts` checks all seven screens, direct links, refreshes, selected plan/run IDs, and browser history. Run browser and PostgreSQL checks against a dedicated local test database, as described in the README.
