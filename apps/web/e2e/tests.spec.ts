import { test, expect } from "@playwright/test";
import { questionDefinitions } from "@manifest/agent";
import type { WorkbenchState } from "@manifest/db";

test("finds personal and shared tests and reopens an older question set", async ({
  page,
  request,
}) => {
  const base: WorkbenchState = await (await request.get("/api/state")).json();
  const plans = ["Alice", "Bob"].map((name, i) => ({
    ...base.plans[0]!,
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    version: i + 1,
    parentId: null,
    authorName: name,
    approval: null,
    answers: {},
    proposal: { ...base.plans[0]!.proposal, questions: questionDefinitions },
  }));
  await page.route("**/api/state", (route) =>
    route.fulfill({
      json: { ...base, plans: [...plans].reverse(), runs: [], sessions: [] },
    }),
  );
  await page.goto("/tests");
  await page.getByRole("textbox", { name: "Operator name" }).fill("Alice");
  await page.getByRole("button", { name: "My tests", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Alice");
  await page.getByRole("button", { name: "All tests", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page
    .getByRole("article")
    .filter({ hasText: "Alice" })
    .getByRole("link", { name: "Answer questions" })
    .click();
  await expect(page).toHaveURL(
    /\/agent\/00000000-0000-4000-8000-000000000001$/,
  );
  await expect(
    page.getByRole("combobox", { name: questionDefinitions[0].question }),
  ).toHaveValue("");
  await page.reload();
  await expect(page.getByText("04/05/2021 → April 5, 2021")).toBeVisible();
  await page
    .getByRole("combobox", { name: questionDefinitions[0].question })
    .selectOption("DD/MM/YYYY");
  const revision = page.waitForRequest(
    (r) => r.url().endsWith("/api/agent") && r.method() === "POST",
  );
  await page.route("**/api/agent", (route) =>
    route.fulfill({ status: 202, json: { id: "pending" } }),
  );
  await page.getByRole("button", { name: "Update plan with answers" }).click();
  expect((await revision).postDataJSON()).toEqual({
    startedBy: "Alice",
    basePlanId: plans[0]!.id,
    answers: { date_order: "DD/MM/YYYY" },
  });
});

test("starts a fresh test without inheriting another user's answers", async ({
  page,
  request,
}) => {
  const base = await (await request.get("/api/state")).json();
  await page.route("**/api/state", (route) =>
    route.fulfill({ json: { ...base, sessions: [] } }),
  );
  await page.route("**/api/agent", (route) =>
    route.fulfill({ status: 202, json: { id: "fresh-session" } }),
  );
  await page.goto("/agent");
  const button = page.getByRole("button", { name: "New test", exact: true });
  await expect(button).toBeDisabled();
  await page.getByRole("textbox", { name: "Operator name" }).fill("Charlie");
  const submitted = page.waitForRequest(
    (r) => r.url().endsWith("/api/agent") && r.method() === "POST",
  );
  await button.click();
  expect((await submitted).postDataJSON()).toEqual({
    startedBy: "Charlie",
    answers: {},
  });
  await expect(
    page.getByText(
      "New test started. The planner will prepare fresh questions for this dataset.",
    ),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Field mapping", exact: true }),
  ).toBeVisible();
});

test("groups revisions, finds contributors, and opens personal run history on mobile", async ({
  page,
  request,
}, testInfo) => {
  const base: WorkbenchState = await (await request.get("/api/state")).json();
  const root = {
    ...base.plans[0]!,
    id: "00000000-0000-4000-8000-000000000010",
    parentId: null,
    version: 10,
    authorName: "Alice",
  };
  const revision = {
    ...root,
    id: "00000000-0000-4000-8000-000000000011",
    parentId: root.id,
    version: 11,
    authorName: "Bob",
  };
  const run = { ...base.runs[0]!, planVersionId: root.id, startedBy: "Alice" };
  await page.route("**/api/state", (route) =>
    route.fulfill({
      json: { ...base, plans: [revision, root], runs: [run], sessions: [] },
    }),
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tests");
  await page.getByRole("textbox", { name: "Operator name" }).fill(" bob ");
  expect(
    (await page.getByRole("textbox", { name: "Operator name" }).boundingBox())!
      .width,
  ).toBeGreaterThan(150);
  await page.getByRole("button", { name: "My tests", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  const versions = page.getByRole("article").locator("summary");
  await versions.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "Questions for version 10" }),
  ).toHaveAttribute("href", `/agent/${root.id}`);
  await expect(
    page.getByRole("link", { name: "Questions for version 11" }),
  ).toHaveAttribute("href", `/agent/${revision.id}`);
  await page.getByRole("textbox", { name: "Operator name" }).fill("Alice");
  await page.locator(".operator-history summary").click();
  await expect(
    page.locator(".operator-menu").getByRole("link").first(),
  ).toHaveAttribute("href", `/runs/${run.id}`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Switch to .* theme/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("test-library-mobile.png"),
    fullPage: true,
  });
});
