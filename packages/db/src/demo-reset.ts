import { hash } from "@manifest/core";
import { randomUUID } from "node:crypto";
import { sampleRecords, targetSeed } from "@manifest/fixtures";
import type { Db } from "./client";
import { cleanTargetRow, targetRows } from "./target";
import { WorkbenchError } from "./workbench";

/** Explicit operator maintenance, never exposed by the public application API. */
export async function resetDemoWorkspace(db: Db, operationId = randomUUID()) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(730031::bigint)::text`;
      await tx.$executeRawUnsafe(
        'LOCK TABLE "Dataset", target.customers, "PlanVersion", "Approval", "Run", "AgentSession", "AgentToolCall", "Reconciliation", "Rollback", "AuditEvent" IN ACCESS EXCLUSIVE MODE',
      );
      if (
        await tx.auditEvent.findFirst({
          where: { type: "demo_workspace_reset", entityId: operationId },
        })
      )
        throw new WorkbenchError(
          "ALREADY_RESET",
          "This maintenance operation has already completed.",
        );
      const dataset = await tx.dataset.findUniqueOrThrow({
        where: { id: "customers" },
      });
      if (
        dataset.datasetHash !== hash(sampleRecords) ||
        hash(dataset.records) !== hash(sampleRecords)
      )
        throw new WorkbenchError(
          "NOT_DEMO",
          "Reset is restricted to the committed synthetic demo dataset.",
        );
      if (
        (await tx.agentSession.count({ where: { status: "running" } })) ||
        (await tx.run.count({ where: { status: "running" } }))
      )
        throw new WorkbenchError(
          "BUSY",
          "Finish all running sessions and migrations before resetting the demo.",
        );
      const rows = await targetRows(tx);
      if (rows.some((row) => row._migration_lineage_id !== null))
        throw new WorkbenchError(
          "ROLLBACK_REQUIRED",
          "Roll back migration-owned target rows before resetting history.",
        );
      const byEmail = (
        a: Record<string, unknown>,
        b: Record<string, unknown>,
      ) => String(a.email).localeCompare(String(b.email));
      if (
        hash(rows.map(cleanTargetRow).sort(byEmail)) !==
        hash([...targetSeed].sort(byEmail))
      )
        throw new WorkbenchError(
          "BASELINE_CHANGED",
          "Reset refused because the seeded target customers have changed.",
        );
      const removed = {
        plans: await tx.planVersion.count(),
        runs: await tx.run.count(),
        sessions: await tx.agentSession.count(),
        events: await tx.auditEvent.count(),
      };
      // This exceptional maintenance bypass is transactional. Normal application
      // writes retain all immutable-history triggers, including after any failure.
      await tx.$executeRawUnsafe(
        'ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_no_truncate',
      );
      await tx.$executeRawUnsafe(
        'TRUNCATE TABLE "AgentToolCall", "AgentSession", "Approval", "Run", "PlanVersion", "Reconciliation", "Rollback", "AuditEvent" RESTART IDENTITY',
      );
      await tx.$executeRawUnsafe(
        'ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_no_truncate',
      );
      await tx.auditEvent.create({
        data: {
          type: "demo_workspace_reset",
          actor: "maintenance",
          entityId: operationId,
          payload: {
            removed,
            sourceRecords: dataset.recordCount,
            targetRecords: rows.length,
          },
        },
      });
      return {
        removed,
        sourceRecords: dataset.recordCount,
        targetRecords: rows.length,
      };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
