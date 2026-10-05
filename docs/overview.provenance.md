# Overview screenshot provenance

| Property    | Value                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Asset       | `docs/overview.png`                                                                                         |
| Source      | Manifest's running production build at `http://localhost:3200/`                                             |
| Capture     | Playwright / Chromium, full-page screenshot                                                                 |
| Viewport    | 1440 × 1000 CSS pixels                                                                                      |
| Appearance  | Light theme; reduced motion enabled                                                                         |
| Captured at | 2026-10-05T10:31:43.772104+00:00                                                                            |
| Data        | Local bounded fixture: 250 staged records, 20 pre-existing target rows, version history from browser checks |
| Processing  | Original browser capture copied without image edits                                                         |

The capture is produced by the phone-layout browser test in `apps/web/e2e/workbench.spec.ts`, which also captures the desktop viewport. Build the application, run the browser tests against a local test database, inspect `apps/web/test-results/desktop-overview.png`, and copy that verified file to `docs/overview.png` when updating the design.

The pictured draft has not yet had a dry run. The record-status section explains that this version needs inspection and links to its plan and source records. The record map appears only after a successful dry run for the latest version. The interface, patterns and record map are rendered in HTML/CSS; fonts are served by Next.js and icons come from Lucide.
