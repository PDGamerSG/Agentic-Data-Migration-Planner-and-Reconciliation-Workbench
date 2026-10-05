import { test, expect, type APIRequestContext } from "@playwright/test";
import type { WorkbenchState } from "@manifest/db";
import { runPlan } from "@manifest/core";
import { createReferencePlan } from "@manifest/fixtures";

async function fixture(request: APIRequestContext) {
  const response = await request.get("/api/state");
  expect(response.ok()).toBe(true);
  const base: WorkbenchState = await response.json();
  const spec = createReferencePlan();
  const plan = {
    ...base.plans[0],
    id: "00000000-0000-4000-8000-000000000001",
    version: 1,
    spec,
    approval: null,
    answers: {},
    authorName: "Test operator",
    proposal: { questions: [], risks: [] },
  };
  const target = base.target.filter((r) => r._migration_lineage_id === null);
  const result = runPlan({
    spec,
    source: base.sourceSchema,
    target: base.targetSchema,
    records: base.dataset.records,
    existing: {
      emails: target.map((r) => String(r.email)),
      legacyIds: target.map((r) => String(r.legacy_id)),
    },
  });
  const inspection = {
    id: "00000000-0000-4000-8000-000000000002",
    planVersionId: plan.id,
    kind: "dry_run",
    status: "succeeded",
    result,
  };
  const summary = {
    id: inspection.id,
    planVersionId: plan.id,
    kind: inspection.kind,
    status: inspection.status,
    counts: result.counts,
    resultHash: result.resultHash,
    startedBy: "Test operator",
    startedAt: "2026-10-01T12:00:00.000Z",
  };
  return {
    state: {
      ...base,
      plans: [plan],
      runs: [summary],
      target,
      sessions: [],
      reconciliations: [],
      rollbacks: [],
    },
    inspection,
  };
}

test("uninspected records show useful guidance instead of an empty grid", async ({
  page,
  request,
}) => {
  const { state } = await fixture(request);
  await page.route("**/api/state", (route) =>
    route.fulfill({ json: { ...state, plans: [], runs: [] } }),
  );
  await page.goto("/");
  const status = page.getByRole("region", {
    name: "Record status",
  });
  await expect(status.getByRole("heading", { level: 3 })).toHaveText(
    "250 records not tested yet",
  );
  await expect(status.locator(".record-grid")).toHaveCount(0);
  await expect(
    status.getByRole("link", { name: "Open AI planner" }),
  ).toHaveAttribute("href", "/agent");
  await status.getByRole("link", { name: "View source data" }).click();
  await expect(page).toHaveURL(/\/schemas$/);
});

test("a new draft does not reuse an older plan's inspection", async ({
  page,
  request,
}) => {
  const { state, inspection } = await fixture(request);
  const draft = {
    ...state.plans[0],
    id: "00000000-0000-4000-8000-000000000003",
    version: 2,
  };
  await page.route("**/api/state", (route) =>
    route.fulfill({ json: { ...state, plans: [draft, ...state.plans] } }),
  );
  await page.route("**/api/runs/*", (route) =>
    route.fulfill({ json: inspection }),
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const status = page.getByRole("region", {
    name: "Record status",
  });
  await expect(status.getByRole("heading", { level: 3 })).toHaveText(
    "250 records not tested yet",
  );
  await expect(status).toContainText("Run a dry run of version 2");
  await expect(status.locator(".record-grid")).toHaveCount(0);
  await expect(status.getByRole("link", { name: "Open plan" })).toHaveAttribute(
    "href",
    `/plans/${draft.id}`,
  );
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(async () =>
        page.evaluate(() => ({
          viewport: window.innerWidth,
          page: document.documentElement.scrollWidth,
        })),
      )
      .toEqual({ viewport: width, page: width });
    await page.screenshot({
      path: `test-results/${name}-overview-uninspected.png`,
      fullPage: true,
    });
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme} overview shows inspection counts and opens held-record evidence`, async ({
    page,
    request,
  }) => {
    const { state, inspection } = await fixture(request);
    await page.route("**/api/state", (route) => route.fulfill({ json: state }));
    await page.route("**/api/runs/*", (route) =>
      route.fulfill({ json: inspection }),
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const status = page.getByRole("region", {
      name: "Record status",
    });
    await expect(status.locator(".record-grid .cell")).toHaveCount(250);
    await expect(status.locator(".record-grid .accepted")).toHaveCount(
      inspection.result.counts.accepted,
    );
    await expect(status.locator(".record-grid button.held")).toHaveCount(
      inspection.result.counts.rejected,
    );
    await expect(status).toContainText("Each square is one record");
    const held = status.locator(".record-grid button.held").first();
    await held.focus();
    await held.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Field errors" }),
    ).toBeVisible();
    if (theme === "dark") {
      await page.screenshot({ path: "test-results/dark-record-evidence.png" });
    }
    await page.getByRole("button", { name: "Close dialog" }).click();
    if (theme === "dark") {
      const contrast = async () =>
        page.evaluate(() => {
          const luminance = (color: string) => {
            const rgb = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((v) => v / 255)
              .map((v) =>
                v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
              );
            return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
          };
          return [
            ".title-band p",
            ".sheet-meta",
            ".rail-link.active",
            ".button.primary",
            ".mark.tone-green",
          ].map((selector) => {
            const element = document.querySelector(selector)!;
            const style = getComputedStyle(element);
            let surface: Element | null = element;
            let background = style.backgroundColor;
            while (
              surface &&
              (background === "rgba(0, 0, 0, 0)" ||
                background === "transparent")
            ) {
              surface = surface.parentElement;
              if (surface)
                background = getComputedStyle(surface).backgroundColor;
            }
            const [hi, lo] = [
              luminance(style.color),
              luminance(background),
            ].sort((a, b) => b - a);
            return { selector, ratio: (hi! + 0.05) / (lo! + 0.05) };
          });
        });
      for (const { selector, ratio } of await contrast()) {
        expect(ratio, `${selector} text contrast`).toBeGreaterThanOrEqual(4.5);
      }
      await page.locator(".button.primary").hover();
      // Wait for the authored color transition before measuring the hover state.
      await page
        .locator(".button.primary")
        .evaluate((element) =>
          Promise.all(
            element.getAnimations().map((animation) => animation.finished),
          ),
        );
      await expect
        .poll(
          async () =>
            (await contrast()).find(
              (entry) => entry.selector === ".button.primary",
            )!.ratio,
        )
        .toBeGreaterThanOrEqual(4.5);
      await page.mouse.move(0, 0);
    }
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(async () =>
          page.evaluate(() => ({
            viewport: window.innerWidth,
            page: document.documentElement.scrollWidth,
          })),
        )
        .toEqual({ viewport: width, page: width });
      await page.screenshot({
        path: `test-results/${theme}-${name}-overview-inspected.png`,
        fullPage: true,
      });
      await page.screenshot({
        path: `test-results/${theme}-${name}-overview-viewport.png`,
        fullPage: false,
      });
    }
  });
}

test("inspection totals remain visible while record details load", async ({
  page,
  request,
}) => {
  const { state, inspection } = await fixture(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/state", (route) => route.fulfill({ json: state }));
  await page.route("**/api/runs/*", async (route) => {
    await gate;
    await route.fulfill({ json: inspection });
  });
  try {
    await page.goto("/");
    const status = page.getByRole("region", {
      name: "Record status",
    });
    await expect(status.locator(".tally-line")).toContainText(
      `${inspection.result.counts.accepted} accepted`,
    );
    await expect(status.getByRole("status")).toHaveText(
      "Loading record details…",
    );
    await expect(status.locator(".record-grid")).toHaveCount(0);
    release();
    await expect(status.locator(".record-grid .cell")).toHaveCount(250);
  } finally {
    release();
  }
});

test("record-detail failure preserves totals and a recovery link", async ({
  page,
  request,
}) => {
  const { state, inspection } = await fixture(request);
  await page.route("**/api/state", (route) => route.fulfill({ json: state }));
  await page.route("**/api/runs/*", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "Unavailable" } } }),
  );
  await page.goto("/");
  const status = page.getByRole("region", {
    name: "Record status",
  });
  await expect(status).toContainText("Record details could not be loaded");
  await expect(status.locator(".tally-line")).toContainText(
    `${inspection.result.counts.accepted} accepted`,
  );
  await expect(
    status.getByRole("link", { name: "Open dry run" }),
  ).toHaveAttribute("href", `/runs/${inspection.id}`);
});

test("execution and failed dry runs do not count as a successful inspection", async ({
  page,
  request,
}) => {
  const { state, inspection } = await fixture(request);
  await page.route("**/api/state", (route) =>
    route.fulfill({
      json: {
        ...state,
        runs: [
          { ...state.runs[0], kind: "execution" },
          { ...state.runs[0], id: "failed-dry", status: "failed" },
        ],
      },
    }),
  );
  await page.route("**/api/runs/*", (route) =>
    route.fulfill({ json: { ...inspection, kind: "execution" } }),
  );
  await page.goto("/");
  const status = page.getByRole("region", {
    name: "Record status",
  });
  await expect(status.getByRole("heading", { level: 3 })).toHaveText(
    "250 records not tested yet",
  );
  await expect(status.locator(".tally-line")).toHaveCount(0);
});
