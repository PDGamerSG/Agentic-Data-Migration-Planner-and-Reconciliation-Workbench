# Manifest interface design

## Purpose and direction

Manifest presents a migration as a declaration that must be inspected and signed before its records move. The interface serves operators reading evidence and reviewers walking the full lifecycle. Numbered fields, ruled sections, typed values and clearance stamps make the plan, its approval and its execution easy to distinguish.

The product remains one source, one target and at most 1,000 staged records. The UI displays persisted state; it cannot bypass the server's approval, retry or rollback rules. [PRODUCT.md](PRODUCT.md) records the audience and scope.

## Visual language

The light theme uses a white document surface with blue rules and labels. The dark theme uses a blue-black surface with pale-blue rules. Draft, held and approved states have separate tints, text labels and mark shapes.

| Role     | Light token | Dark token | Use                                        |
| -------- | ----------- | ---------- | ------------------------------------------ |
| Ground   | `#f2f5f9`   | `#0b1322`  | Workspace surrounding the form             |
| Paper    | `#ffffff`   | `#111c2f`  | Content sections and fields                |
| Text     | `#0e1a2b`   | `#e5edf8`  | Values and body copy                       |
| Form ink | `#133d6b`   | `#8db6ec`  | Rules, navigation and printed labels       |
| Violet   | `#5b2c93`   | `#c4a6f2`  | Human clearance and approval               |
| Red      | `#b3261e`   | `#ff8f85`  | Quarantine, errors and destructive actions |
| Amber    | `#7a5200`   | `#f1cf72`  | Drafts and unresolved decisions            |
| Green    | `#17663f`   | `#7fd7a5`  | Successful loads and matched totals        |

Archivo provides headings and readable prose. Martian Mono provides IDs, timestamps, fingerprints and numerical evidence. Both load through `next/font` and are served with the application. CSS variables in `apps/web/app/globals.css` define the shared palette, type and motion rules.

Status is never represented by a tint alone: committed states use solid marks, pending states use dashed marks, held records use hatching, recalled states use a strike, and running states use a ring. Visible text accompanies the marks.

## Layout and workflow

The desktop navigation rail connects all seven sections. An operator field, environment label and theme toggle remain in the header. Page titles explain the current task, while the primary action follows the next unfinished lifecycle stage.

The overview contains five numbered dataset fields, a record-status section and a routing slip. Before inspection, record status explains the next step and links to the current plan or business decisions and the source records. After a successful dry run for the latest plan, it shows persisted counts and an interactive record map. Counts remain visible while details load; a failed detail request provides a recovery link instead of empty cells. The routing slip derives staged, proposed, decided, inspected, cleared, landed and reconciled states from plans, runs and approvals. A newer draft is explicitly distinguished from an older signed version. Interrupted execution points the operator toward a safe retry.

| Screen                  | Main content and action                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| Overview                | Dataset bounds, per-record state and the next lifecycle action            |
| Schemas & source        | Source profiles, target constraints and paginated source records          |
| Planning agent          | Proposal, business decisions, risks and expandable tool evidence          |
| Migration plans         | Version copies, mapping manifest, field editor, differences and clearance |
| Runs & quarantine       | Counts, deterministic fingerprints, batch progress and rejection evidence |
| Target & reconciliation | Existing and migration-owned rows, comparison checks, retry and rollback  |
| Activity log            | Searchable events with expandable groups for repeated calls and batches   |
| Login                   | Access-code entry and the source/target declaration                       |

“Held” is the visual label for rejected records in quarantine. The count definitions remain source, transformed, accepted and rejected; accepted plus rejected equals source. Acceptance alone does not imply that a row has been inserted.

## Record map and evidence

Each source record has one cell. Uninspected records have dashed outlines, accepted records are solid, held records are hatched, and records present in the migration-owned target receive a landed mark. Landed state compares the transformed `legacy_id` with the actual target keys, since a transform can change the source identifier.

The readout names the record under the pointer. On the overview and run pages, held cells are native buttons that open the same evidence dialog as the quarantine table. Keyboard focus and Enter activate them. Counts and an accessible text summary supplement the visual map.

Fingerprints display a short prefix and copy the full hash. Approval exposes the exact plan and dry-run references and requires every high-risk acknowledgment. Rollback requires a reason. These controls use the existing validated API actions.

## Themes, responsive behavior and accessibility

- With no saved choice, the interface follows the operating system's color preference. Explicit theme choices persist in `manifest-theme`; the initial document applies the saved choice before hydration.
- At narrower widths the rail becomes horizontal navigation, the overview and other splits stack, and dataset fields reflow. Small-screen mapping rows become labeled blocks; other wide ledgers scroll within their own containers.
- Controls use native buttons, links, inputs and dialogs, visible focus indicators and descriptive accessible names. The main-content skip link precedes navigation. Errors, progress and record readouts use appropriate alert or live-region semantics.
- Record inspection uses a short entry sweep; clearance uses a stamp impression. `prefers-reduced-motion` removes staggered delays and reduces animation duration.

The accessibility target is WCAG 2.2 AA. Keyboard, responsive and theme checks support that target; they are not a complete accessibility certification.

## Implementation map

`app/(workbench)/layout.tsx` keeps the shared `WorkbenchApp` mounted across navigation. It owns data fetching, selected versions, operator identity and API actions. Each screen has its own `page.tsx` route and adjacent `view.tsx` UI; `WorkbenchContext` passes shared controls to those screens without duplicating execution logic. [The page editing guide](docs/pages.md) maps each URL to its files.

| Module                        | Responsibility                                                 |
| ----------------------------- | -------------------------------------------------------------- |
| `workbench/lifecycle.ts`      | Derive stage status and the next action from stored state      |
| `workbench/shell.tsx`         | Navigation rail and persistent theme switch                    |
| `workbench/ui.tsx`            | Shared declaration fields, sections, marks, hashes and dialogs |
| `workbench/record-map.tsx`    | Record states, tally, readout and evidence activation          |
| `workbench/dialogs.tsx`       | Approval, rollback and record evidence                         |
| `app/(workbench)/**/page.tsx` | Explicit section and detail routes                             |
| `app/(workbench)/**/view.tsx` | The seven workbench screens                                    |
| `mapping-editor.tsx`          | Structured editing within the closed transform catalog         |

## Verification and assets

The handoff's finish review reported all eight requested adjustments resolved and a ship verdict. The finishing pass also corrected transformed-key matching in the record map and added browser coverage for landed counts, keyboard evidence access and theme persistence.

Verification includes formatting, lint, TypeScript, unit tests, a production build and the browser migration lifecycle: proposal, decisions, dry run, approval, interrupted execution, retry, reconciliation, rollback and version editing. Browser checks also cover cross-origin rejection and mobile layout.

The interface's marks, patterns and record cells are rendered in CSS, and its icons come from Lucide. There are no generated bitmap illustrations. The shipped overview image is a screenshot of the running application; its capture details are recorded in [docs/overview.provenance.md](docs/overview.provenance.md).
