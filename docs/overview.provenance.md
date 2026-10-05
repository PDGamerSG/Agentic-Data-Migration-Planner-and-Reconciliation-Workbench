# Overview screenshot provenance

| Field       | Value                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset       | `docs/overview.png`, `docs/overview-dark.png`, `docs/overview-dark-mobile.png`                                                                                                     |
| Source      | Manifest production build at `http://localhost:3100/`                                                                                                                              |
| Capture     | Project Playwright / Chromium browser check; viewport screenshot                                                                                                                   |
| Viewport    | 1440 Ã— 1000 CSS pixels                                                                                                                                                            |
| Appearance  | Light and dark themes; reduced motion enabled                                                                                                                                      |
| Captured at | 2026-10-05T21:52:45Z                                                                                                                                                               |
| Data        | Deterministic browser scenario using the real bounded source fixture and reference transform plan: 250 source, 234 transformed, 212 accepted, 38 held, 20 pre-existing target rows |
| Processing  | Original browser capture copied without image edits                                                                                                                                |

The inspected-overview test in `apps/web/e2e/overview.spec.ts` calculates the dry-run result with `packages/core` and supplies a deterministic browser state. Its plan/run IDs, version label, operator and run time are synthetic test values; the screenshot does not claim that this scenario is a persisted migration.

Build the application and run the browser checks against a local test database. Copy `apps/web/test-results/light-desktop-overview-viewport.png` to `docs/overview.png`, `docs/overview-dark.png`, `docs/overview-dark-mobile.png` after visual verification. The dark captures are copied from `dark-desktop-overview-viewport.png` to `docs/overview-dark.png` and from `dark-mobile-overview-viewport.png` to `docs/overview-dark-mobile.png` (390 Ã— 844 CSS pixels). All three captures were refreshed at 2026-10-05T21:52:45Z for the Manrope/JetBrains Mono typography and dark palette refinement. The captures show the source-to-target path, record evidence, steps and fixed bottom operator controls. Sections below the first viewport remain available by scrolling.

The interface, patterns and record map are rendered in HTML/CSS; fonts are served by Next.js and icons come from Lucide. No generated bitmap assets are used.
