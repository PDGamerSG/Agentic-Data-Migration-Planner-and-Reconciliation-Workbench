import { config } from "dotenv";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/client";
import { Workbench } from "./workbench";
import { resetDemoWorkspace } from "./demo-reset";
import { questionDefinitions, riskDefinitions } from "@manifest/agent";
config({ path: ".env", quiet: true });
const url = process.env.TEST_DATABASE_URL;
const db = url
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: url, max: 5 }),
    })
  : null;
const wb = db ? new Workbench(db) : null;
const decisions = Object.fromEntries(
  questionDefinitions.map((q) => [q.id, q.options[0]]),
);
const high = riskDefinitions
  .filter((r) => r.severity === "high")
  .map((r) => r.id);
describe.skipIf(!db)("Postgres migration lifecycle", () => {
  beforeAll(async () => {
    await wb!.seed();
    // Recover earlier interrupted verification through the application's own rollback.
    const active = await db!.run.findMany({
      where: { kind: "execution", status: { not: "rolled_back" } },
    });
    for (const lineage of new Set(active.map((r) => r.lineageId)))
      await wb!.rollback(
        lineage,
        "Test operator",
        "Recover interrupted integration test",
      );
  });
  afterAll(async () => {
    await db!.$disconnect();
  });
  it("attributes independent tests and answer revisions to their operators", async () => {
    const first = await wb!.createSession({}, undefined, "  Alice  ");
    await wb!.processSession(first.id);
    const original = (await wb!.state()).plans[0]!;
    expect(original.authorName).toBe("Alice");
    expect(original.parentId).toBeNull();
    const revision = await wb!.createSession(decisions, original.id, "Bob");
    await wb!.processSession(revision.id, original.id);
    const updated = (await wb!.state()).plans[0]!;
    expect(updated.authorName).toBe("Bob");
    expect(updated.parentId).toBe(original.id);
    expect(updated.answers).toEqual(decisions);
    const fresh = await wb!.createSession({}, undefined, "Bob");
    await wb!.processSession(fresh.id);
    const state = await wb!.state();
    expect(state.plans[0]!.parentId).toBeNull();
    expect(state.plans[0]!.answers).toEqual({});
    const namedUser = await wb!.createSession({}, undefined, "user");
    await wb!.processSession(namedUser.id);
    expect((await wb!.state()).plans[0]!.authorName).toBe("user");
    expect(state.plans.find((p) => p.id === original.id)!.answers).toEqual({});
    expect(
      state.history.find(
        (e) => e.entityId === first.id && e.type === "agent_session_started",
      )!.actor,
    ).toBe("Alice");
  });
  it("enforces approval and immutable plan history", async () => {
    const s = await wb!.createSession({});
    await wb!.processSession(s.id);
    const p = (await wb!.state()).plans[0]!;
    const dry = await wb!.dryRun(p.id, "Pallab");
    await expect(wb!.execute(p.id, "Pallab")).rejects.toMatchObject({
      code: "NOT_APPROVED",
    });
    await expect(
      wb!.approve({
        planId: p.id,
        dryRunId: dry.id,
        specHash: p.specHash,
        approvedBy: "Pallab",
        acknowledgedRisks: high,
      }),
    ).rejects.toMatchObject({ code: "UNANSWERED_QUESTIONS" });
    await expect(
      db!.$executeRaw(
        Prisma.sql`UPDATE "PlanVersion" SET "changeSummary"='tampered' WHERE id=${p.id}`,
      ),
    ).rejects.toThrow("append-only");
    await expect(
      db!.$executeRaw`UPDATE "AuditEvent" SET actor='tampered'`,
    ).rejects.toThrow("append-only");
    await expect(db!.$executeRaw`TRUNCATE "AuditEvent"`).rejects.toThrow(
      "append-only",
    );
  });
  it("versions, dry-runs, approves, crashes, retries, reconciles and rolls back without touching existing rows", async () => {
    const initial = (await wb!.state()).plans[0]!;
    const s = await wb!.createSession(decisions, initial.id);
    await wb!.processSession(s.id, initial.id);
    const p = (await wb!.state()).plans[0]!;
    expect(p.parentId).toBe(initial.id);
    expect(p.version).toBeGreaterThan(initial.version);
    const dry = await wb!.dryRun(p.id, "Pallab");
    const repeated = await wb!.dryRun(p.id, "Pallab");
    expect(repeated.result).toEqual(dry.result);
    await expect(
      wb!.approve({
        planId: p.id,
        dryRunId: dry.id,
        specHash: "wrong",
        approvedBy: "Pallab",
        acknowledgedRisks: high,
      }),
    ).rejects.toMatchObject({ code: "STALE_PLAN" });
    await expect(
      wb!.approve({
        planId: p.id,
        dryRunId: dry.id,
        specHash: p.specHash,
        approvedBy: "Pallab",
        acknowledgedRisks: [],
      }),
    ).rejects.toMatchObject({ code: "UNACKNOWLEDGED_RISKS" });
    await wb!.approve({
      planId: p.id,
      dryRunId: dry.id,
      specHash: p.specHash,
      approvedBy: "Pallab",
      acknowledgedRisks: high,
    });
    process.env.ALLOW_FAULT_INJECTION = "true";
    const crashed = await wb!.execute(p.id, "Pallab", 3);
    expect(crashed.run.status).toBe("failed");
    expect(crashed.run.insertedCount).toBe(150);
    const retry = await wb!.execute(p.id, "Pallab");
    expect(retry.run.status).toBe("succeeded");
    expect(retry.run.lineageId).toBe(crashed.run.lineageId);
    expect(retry.run.skippedExisting).toBe(150);
    expect(retry.run.insertedCount + retry.run.skippedExisting).toBe(
      dry.result.counts.accepted,
    );
    const noop = await wb!.execute(p.id, "Pallab");
    expect(noop.noop).toBe(true);
    const report = await wb!.reconcile(retry.run.lineageId, "Pallab");
    expect(report.status).toBe("matched");
    const duplicates = await db!.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM (SELECT legacy_id FROM target.customers WHERE legacy_id IS NOT NULL GROUP BY legacy_id HAVING count(*)>1) d`;
    expect(Number(duplicates[0]!.count)).toBe(0);
    const rollback = await wb!.rollback(
      retry.run.lineageId,
      "Pallab",
      "Lifecycle verification",
    );
    expect(rollback.rowsDeleted).toBe(dry.result.counts.accepted);
    expect((await wb!.state()).target).toHaveLength(20);
    expect((await wb!.reconcile(retry.run.lineageId, "Pallab")).status).toBe(
      "matched",
    );
    expect((await wb!.state()).history.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        "plan_approved",
        "execution_retry_started",
        "execution_failed",
        "execution_retry_noop",
        "rollback_completed",
      ]),
    );
  });
  it("refuses rollback if migrated content was changed", async () => {
    const p = (await wb!.state()).plans[0]!;
    const run = await wb!.execute(p.id, "Pallab");
    expect(run.run.status).toBe("succeeded");
    const row = (await wb!.state()).target.find(
      (r) => r._migration_lineage_id === run.run.lineageId,
    )!;
    await db!.$executeRaw(
      Prisma.sql`UPDATE target.customers SET first_name='Changed' WHERE id=${row.id}`,
    );
    expect((await wb!.reconcile(run.run.lineageId, "Pallab")).status).toBe(
      "mismatch",
    );
    await expect(
      wb!.rollback(run.run.lineageId, "Pallab", "Unsafe rollback"),
    ).rejects.toMatchObject({ code: "CONTENT_DRIFT" });
    await db!.$executeRaw(
      Prisma.sql`UPDATE target.customers SET first_name=${row.first_name} WHERE id=${row.id}`,
    );
    await wb!.rollback(
      run.run.lineageId,
      "Pallab",
      "Restored original content",
    );
  });
  it("rejects target drift between approval and execution", async () => {
    const base = (await wb!.state()).plans[0]!;
    const p = await wb!.savePlan({
      parentId: base.id,
      spec: base.spec,
      authorName: "Pallab",
      changeSummary: "Drift test",
    });
    const dry = await wb!.dryRun(p.id, "Pallab");
    await wb!.approve({
      planId: p.id,
      dryRunId: dry.id,
      specHash: p.specHash,
      approvedBy: "Pallab",
      acknowledgedRisks: high,
    });
    const original = (await wb!.state()).target.find(
      (r) => r._migration_lineage_id === null,
    )!;
    expect(
      await db!.$executeRaw(
        Prisma.sql`UPDATE target.customers SET email='changed-for-integration@example.com' WHERE id=${original.id}`,
      ),
    ).toBe(1);
    try {
      await expect(wb!.execute(p.id, "Pallab")).rejects.toMatchObject({
        code: "DRIFT_DETECTED",
      });
    } finally {
      await db!.$executeRaw(
        Prisma.sql`UPDATE target.customers SET email=${original.email} WHERE id=${original.id}`,
      );
    }
  });
  it("serializes concurrent executions and recovers expired reservations", async () => {
    const p = (await wb!.state()).plans[0]!;
    const attempts = await Promise.allSettled([
      wb!.execute(p.id, "Operator one"),
      wb!.execute(p.id, "Operator two"),
    ]);
    const successful = attempts.filter((a) => a.status === "fulfilled");
    expect(successful.length).toBeGreaterThan(0);
    for (const attempt of attempts)
      if (attempt.status === "rejected")
        expect(attempt.reason).toMatchObject({ code: "BUSY" });
    const execution = (await wb!.state()).runs.find(
      (r) => r.kind === "execution" && r.status === "succeeded",
    )!;
    await db!.run.update({
      where: { id: execution.id },
      data: { status: "running", updatedAt: new Date(Date.now() - 180000) },
    });
    const retry = await wb!.execute(p.id, "Recovery operator");
    expect(retry.run.status).toBe("succeeded");
    expect(retry.run.skippedExisting).toBe(retry.run.result.counts.accepted);
    expect(retry.run.lineageId).toBe(execution.lineageId);
    expect((await wb!.state()).history.map((e) => e.type)).toContain(
      "execution_lease_expired",
    );
    await wb!.rollback(
      retry.run.lineageId,
      "Recovery operator",
      "Concurrent lifecycle test complete",
    );
  });
  it("keeps older runs discoverable after more than twenty newer results", async () => {
    const plan = (await wb!.state()).plans[0]!;
    const first = await wb!.dryRun(plan.id, "History operator");
    for (let i = 0; i < 20; i++) await wb!.dryRun(plan.id, "History operator");
    const summary = (await wb!.state()).runs.find((r) => r.id === first.id)!;
    expect(summary).toMatchObject({
      counts: first.result.counts,
      resultHash: first.result.resultHash,
      startedBy: "History operator",
      planVersionId: plan.id,
    });
    expect(summary).not.toHaveProperty("result");
    expect((await wb!.getRun(first.id)).startedBy).toBe("History operator");
  });

  it("refuses to clear history until migration-owned rows are rolled back", async () => {
    const plan = (await wb!.state()).plans[0]!;
    const execution = await wb!.execute(plan.id, "Maintenance verifier");
    try {
      await expect(resetDemoWorkspace(db!)).rejects.toMatchObject({
        code: "ROLLBACK_REQUIRED",
      });
      expect((await wb!.state()).target.length).toBeGreaterThan(20);
    } finally {
      await wb!.rollback(
        execution.run.lineageId,
        "Maintenance verifier",
        "Reset protection verified",
      );
    }
  });

  it("refuses reset during planning and preserves changed baseline customers", async () => {
    const session = await wb!.createSession(
      {},
      undefined,
      "Maintenance verifier",
    );
    await expect(resetDemoWorkspace(db!)).rejects.toMatchObject({
      code: "BUSY",
    });
    await wb!.processSession(session.id);
    const original = (await wb!.state()).target[0]!;
    await db!
      .$executeRaw`UPDATE target.customers SET first_name='Edited baseline' WHERE id=${original.id}`;
    try {
      await expect(resetDemoWorkspace(db!)).rejects.toMatchObject({
        code: "BASELINE_CHANGED",
      });
      expect((await wb!.state()).target[0]!.first_name).toBe("Edited baseline");
    } finally {
      await db!
        .$executeRaw`UPDATE target.customers SET first_name=${original.first_name} WHERE id=${original.id}`;
    }
  });

  it("rolls back reset and restores history protection when its audit write fails", async () => {
    const before = await wb!.state();
    await db!.$executeRawUnsafe(
      "CREATE FUNCTION fail_reset_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'demo_workspace_reset' THEN RAISE EXCEPTION 'Injected audit failure'; END IF; RETURN NEW; END; $$",
    );
    await db!.$executeRawUnsafe(
      'CREATE TRIGGER fail_reset_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_reset_audit()',
    );
    try {
      await expect(resetDemoWorkspace(db!)).rejects.toThrow(
        "Injected audit failure",
      );
      const after = await wb!.state();
      expect(after.plans).toEqual(before.plans);
      expect(after.runs).toEqual(before.runs);
      expect(after.history).toEqual(before.history);
      await expect(db!.$executeRaw`TRUNCATE "AuditEvent"`).rejects.toThrow(
        "append-only",
      );
    } finally {
      await db!.$executeRawUnsafe(
        'DROP TRIGGER fail_reset_audit ON "AuditEvent"',
      );
      await db!.$executeRawUnsafe("DROP FUNCTION fail_reset_audit()");
    }
  });

  it("clears demo test evidence atomically while retaining fixtures and audit protection", async () => {
    const before = await wb!.state();
    const operationId = crypto.randomUUID();
    const result = await resetDemoWorkspace(db!, operationId);
    const after = await wb!.state();
    expect(result.removed.plans).toBe(before.plans.length);
    expect(after.plans).toEqual([]);
    expect(after.runs).toEqual([]);
    expect(after.sessions).toEqual([]);
    expect(after.reconciliations).toEqual([]);
    expect(after.rollbacks).toEqual([]);
    expect(after.dataset).toEqual(before.dataset);
    expect(after.target).toEqual(before.target);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]!.type).toBe("demo_workspace_reset");
    await expect(resetDemoWorkspace(db!, operationId)).rejects.toMatchObject({
      code: "ALREADY_RESET",
    });
    await expect(db!.$executeRaw`TRUNCATE "AuditEvent"`).rejects.toThrow(
      "append-only",
    );
  });
});
