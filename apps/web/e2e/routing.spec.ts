import { test, expect } from "@playwright/test";
import type { WorkbenchState } from "@manifest/db";

const pages = [
  ["/", "Overview", "Migration overview"],
  ["/schemas", "Source data", "Source data"],
  ["/agent", "AI planner", "AI planner"],
  ["/plans", "Plan", "Plan"],
  ["/runs", "Run results", "Run results"],
  ["/target", "Load & verify", "Load & verify"],
  ["/history", "Activity log", "Activity log"],
] as const;

let state: WorkbenchState;

test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/state");
  expect(response.ok()).toBe(true);
  state = await response.json();
  // A fresh test database also needs real plan and run detail pages to visit.
  if (state.plans.length < 2 || state.runs.length < 2) {
    const headers = { Origin: new URL(response.url()).origin };
    for (let i = 0; i < 2; i++) {
      const draft = await request.post("/api/agent", { headers, data: {} });
      expect(draft.ok()).toBe(true);
      const session: { id: string } = await draft.json();
      await expect
        .poll(
          async () => {
            state = await (await request.get("/api/state")).json();
            return state.sessions.find((s) => s.id === session.id)?.status;
          },
          { timeout: 20000 },
        )
        .toBe("succeeded");
      const dry = await request.post("/api/dry-run", {
        headers,
        data: {
          planId: state.plans[0]!.id,
          startedBy: "Routing test operator",
        },
      });
      expect(dry.ok()).toBe(true);
    }
    state = await (await request.get("/api/state")).json();
  }
});

test("sidebar navigation opens every existing page", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Operator name" })
    .fill("Routing operator");
  for (const [path, label, heading] of pages) {
    const link = page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(
      new URL(path, test.info().project.use.baseURL!).href,
    );
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("textbox", { name: "Operator name" }),
    ).toHaveValue("Routing operator");
  }
});

test("each page opens directly and survives a refresh", async ({ page }) => {
  for (const [path, label, heading] of pages) {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});

test("browser titles identify the page being edited", async ({ request }) => {
  for (const [path, label] of pages) {
    const response = await request.get(path);
    const title = (await response.text()).match(/<title>(.*?)<\/title>/)?.[1];
    expect.soft(title).toBe(`${label.replaceAll("&", "&amp;")} · Manifest`);
  }
});

test("plan detail URLs preserve the selected version through refresh and history", async ({
  page,
}) => {
  const older = state.plans[1]!;
  const latest = state.plans[0]!;
  await page.goto(`/plans/${older.id}`);
  await expect(page.locator(".version-name")).toHaveText(
    `Version ${older.version}`,
  );
  await page.reload();
  await expect(page.locator(".version-name")).toHaveText(
    `Version ${older.version}`,
  );
  await page
    .getByRole("navigation", { name: "Plan versions" })
    .locator(`a[href='/plans/${latest.id}']`)
    .click();
  await expect(page).toHaveURL(new RegExp(`/plans/${latest.id}$`));
  await expect(page.locator(".version-name")).toHaveText(
    `Version ${latest.version}`,
  );
  await page.goBack();
  await expect(page.locator(".version-name")).toHaveText(
    `Version ${older.version}`,
  );
  await page.goForward();
  await expect(page.locator(".version-name")).toHaveText(
    `Version ${latest.version}`,
  );
});

test("run detail URLs preserve the selected result through refresh and history", async ({
  page,
}) => {
  const first = state.runs[0]!;
  const second = state.runs[1]!;
  await page.goto(`/runs/${first.id}`);
  await expect(page.getByRole("combobox", { name: "Run history" })).toHaveValue(
    first.id,
  );
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Run history" })).toHaveValue(
    first.id,
  );
  await page
    .getByRole("combobox", { name: "Run history" })
    .selectOption(second.id);
  await expect(page).toHaveURL(new RegExp(`/runs/${second.id}$`));
  await expect(page.getByRole("combobox", { name: "Run history" })).toHaveValue(
    second.id,
  );
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Run history" })).toHaveValue(
    first.id,
  );
  await page.goForward();
  await expect(page.getByRole("combobox", { name: "Run history" })).toHaveValue(
    second.id,
  );
});

test("unsupported routes remain not found", async ({ request }) => {
  for (const path of ["/missing-page", "/schemas/extra", "/plans/one/extra"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
