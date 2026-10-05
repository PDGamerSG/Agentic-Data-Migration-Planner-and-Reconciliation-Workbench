import { test, expect } from "@playwright/test";
test.describe.configure({ mode: "serial" });
test("approve, interrupt, retry, reconcile and roll back a migration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const stateResponse = await page.request.get("/api/state");
  const prior = await stateResponse.json();
  const activeLineages = new Set<string>(
    prior.runs
      .filter(
        (r: { kind: string; status: string }) =>
          r.kind === "execution" && r.status !== "rolled_back",
      )
      .map((r: { lineageId: string }) => r.lineageId),
  );
  for (const lineageId of activeLineages) {
    const cleanup = await page.request.post("/api/rollback", {
      headers: { Origin: new URL(stateResponse.url()).origin },
      data: {
        lineageId,
        requestedBy: "Test operator",
        reason: "Recover interrupted browser verification",
      },
    });
    expect(cleanup.ok()).toBe(true);
  }
  await page.goto("/agent");
  await page
    .getByRole("textbox", { name: "Operator name" })
    .fill("Test operator");
  const initialResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/agent") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: /^(Create plan with AI|Update plan with answers)$/,
    })
    .click();
  const initialSession = await (await initialResponse).json();
  await expect
    .poll(
      async () => {
        const state = await (await page.request.get("/api/state")).json();
        return state.sessions.find(
          (session: { id: string }) => session.id === initialSession.id,
        )?.status;
      },
      { timeout: 20000 },
    )
    .toBe("succeeded");
  await expect(
    page.getByRole("heading", { name: "Questions for you" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", {
      name: "Which slash-date order should take priority?",
    }),
  ).toBeVisible({ timeout: 20000 });
  const options: [string, string][] = [
    ["Which slash-date order should take priority?", "MM/DD/YYYY"],
    ["How should undocumented status X be handled?", "reject"],
    ["How should N/A credit limits be handled?", "reject"],
    ["Confirm marketing consent defaults to false.", "confirmed"],
    ["Confirm legacy notes can be omitted.", "confirmed"],
    ["Confirm legacy login IP addresses can be omitted.", "confirmed"],
    ["How should duplicate source emails be handled?", "first"],
  ];
  for (const [name, value] of options)
    await page.getByRole("combobox", { name, exact: true }).selectOption(value);
  await expect(
    page.getByRole("button", { name: "Update plan with answers" }),
  ).toBeEnabled();
  const redraftResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/agent") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Update plan with answers" }).click();
  const redraftSession = await (await redraftResponse).json();
  await expect
    .poll(
      async () => {
        const state = await (await page.request.get("/api/state")).json();
        return state.sessions.find(
          (session: { id: string }) => session.id === redraftSession.id,
        )?.status;
      },
      { timeout: 20000 },
    )
    .toBe("succeeded");
  const latestState = await (await page.request.get("/api/state")).json();
  await page
    .getByRole("link", {
      name: `Open version ${latestState.plans.find((p: { agentSessionId: string }) => p.agentSessionId === redraftSession.id).version}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Field mapping" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review & approve" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Run dry run" }).click();
  await expect(
    page.getByRole("heading", { name: "Held records" }),
  ).toBeVisible();
  const heldRecord = page.locator(".record-grid button.held").first();
  await heldRecord.focus();
  await heldRecord.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Field errors" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Inspect", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Field errors" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Transformation steps" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  const recordStatus = page.getByRole("region", { name: "Record status" });
  await expect(recordStatus.locator(".record-grid button.held")).toHaveCount(
    38,
  );
  await recordStatus.getByRole("link", { name: "Open dry run" }).click();
  await page.getByRole("link", { name: "Review this plan" }).click();
  await page.getByRole("button", { name: "Review & approve" }).click();
  await expect(
    page.getByRole("button", { name: "Approve this version" }),
  ).toBeDisabled();
  for (const checkbox of await page
    .getByRole("dialog")
    .getByRole("checkbox")
    .all())
    await checkbox.check();
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText("Approved by Test operator")).toBeVisible();
  await page.getByRole("link", { name: "Load & verify", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Simulate interruption after batch 3" })
    .check();
  await page.getByRole("button", { name: "Load approved records" }).click();
  await expect(
    page.getByRole("button", { name: "Retry migration safely" }),
  ).toBeVisible();
  await expect(
    page.getByText("Simulated interruption after committed batch 3"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry migration safely" }).click();
  await expect(
    page.getByTestId("skipped-existing").locator("strong"),
  ).toHaveText("150");
  await page.getByRole("link", { name: "Load & verify", exact: true }).click();
  await expect(page.getByText("matched", { exact: true })).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  const latest = state.runs.find(
    (r: { kind: string }) => r.kind === "execution",
  );
  expect(latest.skippedExisting).toBe(150);
  expect(state.target.length).toBe(20 + latest.counts.accepted);
  await page.goto(`/runs/${latest.id}`);
  await expect(page.locator(".record-grid .cell.landed")).toHaveCount(
    latest.counts.accepted,
  );
  await expect(page.locator(".record-grid .cell.held")).toHaveCount(
    latest.counts.rejected,
  );
  await page.getByRole("link", { name: "Load & verify", exact: true }).click();
  await page.getByRole("button", { name: "Roll back migration" }).click();
  await page
    .getByRole("textbox", { name: "Reason for rollback" })
    .fill("Completed end-to-end verification");
  await page.getByRole("button", { name: "Confirm rollback" }).click();
  await expect(
    page.getByRole("heading", { name: "20 rows in the target table" }),
  ).toBeVisible();
  await expect(page.getByText("matched", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Activity log", exact: true }).click();
  await expect(
    page.getByText("rollback completed", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("execution retry started", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("persists theme choice across reloads and navigation", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "Dataset", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dark-overview.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Source data", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("edits create a new draft with a separate approval requirement", async ({
  page,
}) => {
  await page.goto("/plans");
  await page
    .getByRole("textbox", { name: "Operator name" })
    .fill("Test operator");
  await page.getByRole("button", { name: "Edit as new version" }).click();
  await page
    .getByRole("textbox", { name: "Validation reference date" })
    .fill("2026-10-05");
  await page
    .getByRole("textbox", { name: "Change summary" })
    .fill("Update the validation reference date");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(
    page
      .getByText("Update the validation reference date", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review & approve" }),
  ).toBeDisabled();
});
test("rejects cross-origin writes and remains usable on a phone", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/execute", {
    headers: { Origin: "https://unrelated.example" },
    data: {},
  });
  expect(response.status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Operator name" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Migration overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dataset", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Source data", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-overview.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
  });
});
