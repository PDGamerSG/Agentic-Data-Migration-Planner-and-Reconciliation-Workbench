---
version: 1
slug: "apps-web"
primary_target: "apps/web"
related_targets: []
---

## Scope

Whole Manifest workbench web app (`apps/web`): overview, schemas, agent, plans, runs, target, history. Mode: Operate.

## Audience and task

Assignment reviewers walking the full migration lifecycle in minutes, and migration operators reading dense evidence. Constraints: light + dark themes; existing behaviour, routes and API untouched.

## Direction contract

THESIS: The migration is a declared consignment. Every screen is a page of one customs declaration — numbered boxes ruled in one form ink, typed values, a human clearance stamp. Refuses the gray-card SaaS dashboard with KPI tiles.
OWN-WORLD: White top-copy ground; customs-blue form ink (#123c69) for every rule, box number and label; typed data in condensed mono; carbonless copy tints (yellow draft, pink held) as row/box fills; violet stamp-pad ink only for human clearance; red only for held/danger. State by mark form too: dashed pending, solid committed, hatched held, struck recalled. Dark = carbon sheet: blue-black ground, pale-blue impressions.
STORY: Visitor sees the whole consignment (250 cells), sees which stage it is at on the routing slip, does the next stamped step, and can trace any held record to its exact failed step.
FIRST VIEWPORT: Overview = title band (form title left, declaration no. + next-step action right); row of numbered boxes (consignor, consignee, packages 250/1,000, declared plan, planner); below, record map of 250 cells (2/3 width) with tally legend; routing slip of stamp boxes (1/3) with the next action.
FORM: Customs declaration / bill of lading, candidate 6 of 7, seed ff1bfea2. Raises: hairline module density (JP high-density), state-by-mark-form (labanotation, emission rail), whole-cell record map (circle catalog). Signature: record-map inspection sweep + clearance stamp press.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
