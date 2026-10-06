import { randomUUID } from "node:crypto";
import {
  checkPlan,
  diffPlans,
  hash,
  planSpecSchema,
  reconcile,
  runPlan,
  testMapping,
  type PlanSpec,
  type RunResult,
  type SourceRecord,
} from "@manifest/core";
import {
  sampleRecords,
  sourceSchema,
  targetSchema,
  targetSeed,
} from "@manifest/fixtures";
import {
  answersSchema,
  questionDefinitions,
  riskDefinitions,
  runAgent,
  type Proposal,
  type ToolCallRecord,
} from "@manifest/agent";
import { Prisma, type Run } from "./generated/prisma/client";
import { getDb, type Db, type Tx } from "./client";
import {
  cleanTargetRow,
  insertTarget,
  insertTargetBatch,
  targetKeys,
  targetRows,
} from "./target";
export class WorkbenchError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const requireName = (name: string) => {
  if (!name.trim() || name.length > 100)
    throw new WorkbenchError(
      "INVALID_ACTOR",
      "Provide a name (1–100 characters).",
      400,
    );
  return name.trim();
};
const id = () => randomUUID();
/** GROQ_API_KEY plus any comma-separated GROQ_API_KEYS; sessions spread across them. */
const groqKeys = () =>
  [process.env.GROQ_API_KEY, ...(process.env.GROQ_API_KEYS ?? "").split(",")]
    .map((key) => key?.trim() ?? "")
    .filter(Boolean);
const LOCK = 730031;
export type RunView = Omit<Run, "result"> & { result: RunResult };
type SavedRunSummary = Omit<Run, "result"> & {
  counts: RunResult["counts"];
  resultHash: string;
};
const runView = (run: Run): RunView => ({
  ...run,
  result: run.result as unknown as RunResult,
});
async function audit(
  tx: Tx,
  type: string,
  actor: string,
  entityId: string | null,
  payload: unknown = {},
) {
  await tx.auditEvent.create({
    data: { type, actor, entityId, payload: json(payload) },
  });
}
export class Workbench {
  constructor(readonly db: Db = getDb()) {}
  private async locked<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK}::bigint)::text`;
        return fn(tx);
      },
      { maxWait: 10000, timeout: 45000 },
    );
  }
  async seed() {
    return this.locked(async (tx) => {
      if (await tx.dataset.findUnique({ where: { id: "customers" } })) return;
      const existing = await targetRows(tx);
      if (existing.length)
        throw new WorkbenchError(
          "SEED_CONFLICT",
          "Target is not empty; seed refused.",
        );
      await tx.dataset.create({
        data: {
          id: "customers",
          name: sourceSchema.name,
          records: json(sampleRecords),
          datasetHash: hash(sampleRecords),
          recordCount: sampleRecords.length,
        },
      });
      for (const row of targetSeed) await insertTarget(tx, row, null, null);
      await audit(tx, "dataset_seeded", "system", "customers", {
        source: 250,
        baseline: 20,
      });
    });
  }
  async dataset() {
    const d = await this.db.dataset.findUnique({ where: { id: "customers" } });
    if (!d)
      throw new WorkbenchError(
        "NOT_SEEDED",
        "Run pnpm db:deploy and pnpm db:seed first.",
        503,
      );
    return { ...d, records: d.records as unknown as SourceRecord[] };
  }
  private async plan(tx: Tx, planId: string) {
    const p = await tx.planVersion.findUnique({
      where: { id: planId },
      include: { approvals: true },
    });
    if (!p) throw new WorkbenchError("NOT_FOUND", "Plan not found.", 404);
    return {
      ...p,
      spec: planSpecSchema.parse(p.spec),
      proposal: p.proposal as unknown as Proposal,
      answers: p.answers as Record<string, string>,
    };
  }
  async state() {
    const [
      dataset,
      plans,
      runs,
      target,
      history,
      sessions,
      reconciliations,
      rollbacks,
    ] = await Promise.all([
      this.dataset(),
      this.db.planVersion.findMany({
        orderBy: { version: "desc" },
        include: { approvals: true },
      }),
      // Keep every run discoverable without loading record payloads and traces
      // into each state response. Detailed evidence stays behind getRun.
      this.db.$queryRaw<SavedRunSummary[]>`
        SELECT "id", "kind", "planVersionId", "specHash", "datasetHash",
          "targetKeysHash", "lineageId", "attempt", "retryOfId", "idempotencyKey",
          "status", "baselineCount", "insertedCount", "skippedExisting",
          "batchesCommitted", "error", "startedBy", "startedAt", "updatedAt",
          "finishedAt", "result"->'counts' AS "counts",
          "result"->>'resultHash' AS "resultHash"
        FROM "Run" ORDER BY "startedAt" DESC
      `,
      targetRows(this.db),
      this.db.auditEvent.findMany({ orderBy: { id: "desc" }, take: 150 }),
      this.db.agentSession.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { calls: { orderBy: { seq: "asc" } } },
      }),
      this.db.reconciliation.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.db.rollback.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    return {
      dataset,
      sourceSchema,
      targetSchema,
      maxRecords: 1000,
      provider: groqKeys().length ? "groq" : "offline",
      faultInjection: process.env.ALLOW_FAULT_INJECTION === "true",
      plans: plans.map((p) => ({
        ...p,
        spec: planSpecSchema.parse(p.spec),
        proposal: p.proposal as unknown as Proposal,
        answers: p.answers as Record<string, string>,
        approval: p.approvals[0] ?? null,
        diff:
          p.parentId && plans.find((old) => old.id === p.parentId)
            ? diffPlans(
                planSpecSchema.parse(
                  plans.find((old) => old.id === p.parentId)!.spec,
                ),
                planSpecSchema.parse(p.spec),
              )
            : null,
      })),
      runs,
      target,
      history,
      sessions,
      reconciliations: reconciliations.map((r) => ({
        ...r,
        report: r.report as unknown as ReturnType<typeof reconcile>,
      })),
      rollbacks,
    };
  }
  async savePlan(input: {
    parentId?: string;
    spec: PlanSpec;
    authorName: string;
    changeSummary: string;
    answers?: Record<string, string>;
    proposal?: Proposal;
    agentSessionId?: string;
  }) {
    const spec = planSpecSchema.parse(input.spec);
    const actor = requireName(input.authorName);
    const issues = checkPlan(spec, sourceSchema, targetSchema);
    if (issues.some((i) => i.severity === "error"))
      throw new WorkbenchError(
        "INVALID_PLAN",
        issues.map((i) => `${i.field}: ${i.message}`).join("; "),
        400,
      );
    return this.locked(async (tx) => {
      const parent = input.parentId
        ? await this.plan(tx, input.parentId)
        : null;
      const latest = await tx.planVersion.findFirst({
        orderBy: { version: "desc" },
      });
      const answers = answersSchema.parse(
        input.answers ?? parent?.answers ?? {},
      );
      const proposal = input.proposal ?? parent?.proposal;
      if (!proposal)
        throw new WorkbenchError(
          "NO_PROPOSAL",
          "Start with an agent proposal.",
          400,
        );
      const datasetRecords = (
        await tx.dataset.findUniqueOrThrow({ where: { id: "customers" } })
      ).records as unknown as SourceRecord[];
      const p = await tx.planVersion.create({
        data: {
          id: id(),
          version: (latest?.version ?? 0) + 1,
          parentId: parent?.id,
          authorName: actor,
          changeSummary:
            input.changeSummary.trim().slice(0, 500) || "Updated mappings",
          spec: json(spec),
          specHash: hash(spec),
          issues: json(issues),
          proposal: json({
            ...proposal,
            spec,
            measured: Object.fromEntries(
              spec.mappings.map((m) => [
                m.targetField,
                testMapping(m, datasetRecords),
              ]),
            ),
          }),
          answers: json(answers),
          agentSessionId: input.agentSessionId,
        },
      });
      await audit(tx, "plan_version_created", actor, p.id, {
        version: p.version,
        specHash: p.specHash,
        diff: parent ? diffPlans(parent.spec, spec) : null,
      });
      return p;
    });
  }
  async createSession(
    answers: Record<string, string>,
    basePlanId?: string,
    startedBy?: string,
  ) {
    const actor = requireName(startedBy ?? "user");
    const valid = answersSchema.parse(answers);
    if (basePlanId) await this.plan(this.db, basePlanId);
    const recent = await this.db.agentSession.count({
      where: { createdAt: { gte: new Date(Date.now() - 3600000) } },
    });
    if (recent >= 20)
      throw new WorkbenchError(
        "RATE_LIMIT",
        "This workbench allows 20 agent sessions per hour.",
        429,
      );
    return this.locked(async (tx) => {
      const session = await tx.agentSession.create({
        data: {
          id: id(),
          provider: groqKeys().length ? "groq" : "offline",
          model: groqKeys().length
            ? (process.env.GROQ_MODEL ?? "openai/gpt-oss-120b")
            : "deterministic-v1",
          status: "running",
          answers: json(valid),
        },
      });
      await audit(tx, "agent_session_started", actor, session.id, {
        provider: session.provider,
        basePlanId: basePlanId ?? null,
        startedBy: startedBy === undefined ? null : actor,
      });
      return session;
    });
  }
  async processSession(sessionId: string, basePlanId?: string) {
    const session = await this.db.agentSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    let seq = 0;
    try {
      const dataset = await this.dataset();
      const started = await this.db.auditEvent.findFirst({
        where: { type: "agent_session_started", entityId: sessionId },
      });
      const namedOperator =
        started &&
        typeof started.payload === "object" &&
        started.payload !== null &&
        "startedBy" in started.payload &&
        typeof started.payload.startedBy === "string";
      const parent = basePlanId ? await this.plan(this.db, basePlanId) : null;
      const onCall = async (call: ToolCallRecord) => {
        await this.db.$transaction(async (tx) => {
          await tx.agentToolCall.create({
            data: {
              id: id(),
              sessionId,
              seq: ++seq,
              tool: call.tool,
              args: json(call.args),
              result: json(call.result),
              rejected: call.rejected,
              durationMs: call.durationMs,
            },
          });
          await audit(
            tx,
            call.rejected ? "agent_tool_rejected" : "agent_tool_called",
            "agent",
            sessionId,
            { tool: call.tool, seq },
          );
        });
      };
      const proposal = await runAgent({
        records: dataset.records,
        answers: session.answers as Record<string, string>,
        basePlan: parent?.spec,
        onCall,
        apiKeys: groqKeys(),
        model: process.env.GROQ_MODEL,
        fallbackModel:
          process.env.GROQ_FALLBACK_MODEL === undefined
            ? undefined
            : process.env.GROQ_FALLBACK_MODEL || null,
        onModelChange: async (model) => {
          await this.db.$transaction(async (tx) => {
            await tx.agentSession.update({
              where: { id: sessionId },
              data: { model },
            });
            await audit(tx, "agent_model_changed", "agent", sessionId, {
              model,
              reason: "provider_rate_limit",
            });
          });
        },
      });
      const plan = await this.savePlan({
        parentId: basePlanId,
        spec: proposal.spec,
        authorName: namedOperator
          ? started.actor
          : session.provider === "offline"
            ? "Offline planner"
            : "Groq planner",
        changeSummary: basePlanId
          ? "Re-drafted with clarification answers"
          : "Initial migration proposal",
        answers: session.answers as Record<string, string>,
        proposal,
        agentSessionId: sessionId,
      });
      await this.db.$transaction(async (tx) => {
        await tx.agentSession.update({
          where: { id: sessionId },
          data: {
            status: "succeeded",
            proposal: json(proposal),
            finishedAt: new Date(),
          },
        });
        await audit(tx, "agent_session_completed", "agent", sessionId, {
          planId: plan.id,
        });
      });
    } catch (error) {
      await this.db.$transaction(async (tx) => {
        await tx.agentSession.update({
          where: { id: sessionId },
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Planner failed",
            finishedAt: new Date(),
          },
        });
        await audit(tx, "agent_session_failed", "agent", sessionId, {});
      });
    }
  }
  async dryRun(planId: string, startedBy: string) {
    const actor = requireName(startedBy);
    return this.locked(async (tx) => {
      const p = await this.plan(tx, planId);
      const dataset = await tx.dataset.findUniqueOrThrow({
        where: { id: "customers" },
      });
      const rows = await targetRows(tx);
      const result = runPlan({
        spec: p.spec,
        source: sourceSchema,
        target: targetSchema,
        records: dataset.records as unknown as SourceRecord[],
        existing: targetKeys(rows),
      });
      const runId = id();
      const run = await tx.run.create({
        data: {
          id: runId,
          kind: "dry_run",
          planVersionId: planId,
          specHash: p.specHash,
          datasetHash: dataset.datasetHash,
          targetKeysHash: result.targetKeysHash,
          lineageId: runId,
          status: "succeeded",
          result: json(result),
          baselineCount: rows.length,
          startedBy: actor,
          finishedAt: new Date(),
        },
      });
      await audit(tx, "dry_run_completed", actor, runId, {
        planId,
        counts: result.counts,
        resultHash: result.resultHash,
      });
      return runView(run);
    });
  }
  async approve(input: {
    planId: string;
    dryRunId: string;
    specHash: string;
    approvedBy: string;
    acknowledgedRisks: string[];
    comment?: string;
  }) {
    const actor = requireName(input.approvedBy);
    return this.locked(async (tx) => {
      const p = await this.plan(tx, input.planId);
      if (p.specHash !== input.specHash)
        throw new WorkbenchError("STALE_PLAN", "The plan fingerprint changed.");
      if (p.approvals.length)
        throw new WorkbenchError(
          "ALREADY_APPROVED",
          "This immutable version is already approved.",
        );
      const missingQuestions = p.proposal.questions.filter(
        (q) => q.blocking && !p.answers[q.id],
      );
      if (
        missingQuestions.length ||
        questionDefinitions.some((q) => !p.answers[q.id])
      )
        throw new WorkbenchError(
          "UNANSWERED_QUESTIONS",
          "Answer the business questions and re-draft before approval.",
        );
      const requiredRisks = new Set([
        ...riskDefinitions
          .filter((r) => r.severity === "high")
          .map((r) => r.id),
        ...p.proposal.risks
          .filter((r) => r.severity === "high")
          .map((r) => r.id),
      ]);
      if ([...requiredRisks].some((r) => !input.acknowledgedRisks.includes(r)))
        throw new WorkbenchError(
          "UNACKNOWLEDGED_RISKS",
          "Acknowledge every high risk before approval.",
        );
      const dry = await tx.run.findUnique({ where: { id: input.dryRunId } });
      if (
        !dry ||
        dry.kind !== "dry_run" ||
        dry.status !== "succeeded" ||
        dry.planVersionId !== p.id ||
        dry.specHash !== p.specHash
      )
        throw new WorkbenchError(
          "INVALID_DRY_RUN",
          "Approval must reference a successful dry run of this exact version.",
        );
      const dataset = await tx.dataset.findUniqueOrThrow({
        where: { id: "customers" },
      });
      const rows = await targetRows(tx);
      const current = runPlan({
        spec: p.spec,
        source: sourceSchema,
        target: targetSchema,
        records: dataset.records as unknown as SourceRecord[],
        existing: targetKeys(rows),
      });
      if (
        dataset.datasetHash !== dry.datasetHash ||
        current.resultHash !== (dry.result as unknown as RunResult).resultHash
      )
        throw new WorkbenchError(
          "DRIFT_DETECTED",
          "Source or target changed. Create a new dry run.",
        );
      const approval = await tx.approval.create({
        data: {
          id: id(),
          planVersionId: p.id,
          dryRunId: dry.id,
          specHash: p.specHash,
          approvedBy: actor,
          acknowledgedRisks: json(input.acknowledgedRisks),
          comment: input.comment?.slice(0, 500) ?? "",
        },
      });
      await audit(tx, "plan_approved", actor, p.id, {
        approvalId: approval.id,
        dryRunId: dry.id,
        specHash: p.specHash,
      });
      return approval;
    });
  }
  async getRun(runId: string) {
    const run = await this.db.run.findUnique({ where: { id: runId } });
    if (!run) throw new WorkbenchError("NOT_FOUND", "Run not found.", 404);
    return runView(run);
  }
  async execute(planId: string, startedBy: string, failAfterBatch?: number) {
    const actor = requireName(startedBy);
    if (
      failAfterBatch !== undefined &&
      process.env.ALLOW_FAULT_INJECTION !== "true"
    )
      throw new WorkbenchError(
        "FAULT_INJECTION_DISABLED",
        "Fault injection is disabled.",
        400,
      );
    const prepared = await this.locked(async (tx) => {
      // A killed server cannot retain a permanent running reservation. Batch writes re-check status.
      const abandoned = await tx.run.findMany({
        where: {
          kind: "execution",
          status: "running",
          updatedAt: { lt: new Date(Date.now() - 120000) },
        },
      });
      for (const old of abandoned) {
        await tx.run.update({
          where: { id: old.id },
          data: {
            status: "failed",
            error: "Execution lease expired; safe to retry",
            finishedAt: new Date(),
          },
        });
        await audit(tx, "execution_lease_expired", "system", old.id, {});
      }
      const p = await this.plan(tx, planId);
      const approval = p.approvals[0];
      if (!approval || approval.specHash !== p.specHash)
        throw new WorkbenchError(
          "NOT_APPROVED",
          "Approve this exact plan version before execution.",
        );
      const dataset = await tx.dataset.findUniqueOrThrow({
        where: { id: "customers" },
      });
      const key = hash({
        planId,
        specHash: p.specHash,
        datasetHash: dataset.datasetHash,
      });
      const last = await tx.run.findFirst({
        where: {
          kind: "execution",
          idempotencyKey: key,
          status: { not: "rolled_back" },
        },
        orderBy: { startedAt: "desc" },
      });
      if (last?.status === "running")
        throw new WorkbenchError(
          "BUSY",
          "An execution is already running. Retry after it finishes or its lease expires.",
        );
      if (last?.status === "succeeded") {
        await audit(tx, "execution_retry_noop", actor, last.id, {});
        return { run: runView(last), noop: true };
      }
      const activeOther = await tx.run.findFirst({
        where: {
          kind: "execution",
          status: { not: "rolled_back" },
          planVersionId: { not: planId },
        },
      });
      if (activeOther)
        throw new WorkbenchError(
          "ACTIVE_MIGRATION",
          "Roll back the existing migration before executing another version.",
        );
      const approvedDry = await tx.run.findUniqueOrThrow({
        where: { id: approval.dryRunId },
      });
      const approvedResult = approvedDry.result as unknown as RunResult;
      const runId = id();
      const lineage = last?.lineageId ?? runId;
      const rows = await targetRows(tx, lineage);
      const computed = runPlan({
        spec: p.spec,
        source: sourceSchema,
        target: targetSchema,
        records: dataset.records as unknown as SourceRecord[],
        existing: targetKeys(rows),
      });
      if (
        computed.resultHash !== approvedResult.resultHash ||
        dataset.datasetHash !== approvedDry.datasetHash
      )
        throw new WorkbenchError(
          "DRIFT_DETECTED",
          "The source or target differs from the approved dry run.",
        );
      const owned = (await targetRows(tx)).filter(
        (r) => r._migration_lineage_id === lineage,
      );
      const expected = new Map(
        approvedResult.outcomes
          .filter((o) => o.status === "accepted")
          .map((o) => [String(o.row.legacy_id), o.rowHash]),
      );
      if (
        owned.some(
          (r) => hash(cleanTargetRow(r)) !== expected.get(String(r.legacy_id)),
        )
      )
        throw new WorkbenchError(
          "CONTENT_DRIFT",
          "Previously loaded rows changed; inspect before retry.",
        );
      const run = await tx.run.create({
        data: {
          id: runId,
          kind: "execution",
          planVersionId: p.id,
          specHash: p.specHash,
          datasetHash: dataset.datasetHash,
          targetKeysHash: computed.targetKeysHash,
          lineageId: lineage,
          attempt: (last?.attempt ?? 0) + 1,
          retryOfId: last?.id,
          idempotencyKey: key,
          status: "running",
          result: json(approvedResult),
          baselineCount: approvedDry.baselineCount,
          startedBy: actor,
        },
      });
      await audit(
        tx,
        last ? "execution_retry_started" : "execution_started",
        actor,
        runId,
        { lineage, attempt: run.attempt },
      );
      return { run: runView(run), noop: false };
    });
    if (prepared.noop) return prepared;
    const { run } = prepared;
    try {
      const accepted = run.result.outcomes.filter(
        (o) => o.status === "accepted",
      );
      for (let offset = 0; offset < accepted.length; offset += 50) {
        await this.locked(async (tx) => {
          const live = await tx.run.findUniqueOrThrow({
            where: { id: run.id },
          });
          if (live.status !== "running")
            throw new WorkbenchError(
              "LEASE_LOST",
              "This execution lost its reservation.",
            );
          const batch = accepted.slice(offset, offset + 50);
          const insertedRows = await insertTargetBatch(
            tx,
            batch,
            run.lineageId,
          );
          const inserted = insertedRows.length;
          if (inserted < batch.length) {
            const insertedIds = new Set(insertedRows.map((r) => r.legacy_id));
            const owned = new Map(
              (await targetRows(tx)).map((r) => [String(r.legacy_id), r]),
            );
            for (const outcome of batch.filter(
              (o) => !insertedIds.has(String(o.row.legacy_id)),
            )) {
              const row = owned.get(String(outcome.row.legacy_id));
              if (
                !row ||
                row._migration_lineage_id !== run.lineageId ||
                row._row_hash !== outcome.rowHash ||
                hash(cleanTargetRow(row)) !== outcome.rowHash
              )
                throw new WorkbenchError(
                  "TARGET_CONFLICT",
                  "A skipped row is not identical and owned by this migration.",
                );
            }
          }
          await tx.run.update({
            where: { id: run.id },
            data: {
              insertedCount: { increment: inserted },
              skippedExisting: { increment: batch.length - inserted },
              batchesCommitted: { increment: 1 },
            },
          });
          await audit(tx, "execution_batch_committed", actor, run.id, {
            batch: offset / 50 + 1,
            inserted,
            skipped: batch.length - inserted,
          });
        });
        if (failAfterBatch === offset / 50 + 1)
          throw new Error(
            `Simulated interruption after committed batch ${failAfterBatch}`,
          );
      }
      await this.locked(async (tx) => {
        const live = await tx.run.findUniqueOrThrow({ where: { id: run.id } });
        if (live.status !== "running")
          throw new WorkbenchError(
            "LEASE_LOST",
            "Execution reservation expired.",
          );
        await tx.run.update({
          where: { id: run.id },
          data: { status: "succeeded", finishedAt: new Date() },
        });
        await this.reconcileTx(tx, run.lineageId, actor);
        await audit(tx, "execution_succeeded", actor, run.id, {
          lineage: run.lineageId,
        });
      });
    } catch (error) {
      await this.locked(async (tx) => {
        const live = await tx.run.findUniqueOrThrow({ where: { id: run.id } });
        if (live.status === "running") {
          await tx.run.update({
            where: { id: run.id },
            data: {
              status: "failed",
              error:
                error instanceof Error ? error.message : "Execution failed",
              finishedAt: new Date(),
            },
          });
          await audit(tx, "execution_failed", actor, run.id, {
            error: error instanceof Error ? error.message : "Execution failed",
          });
        }
      });
    }
    return { run: await this.getRun(run.id), noop: false };
  }
  private async reconcileTx(tx: Tx, lineageId: string, actor: string) {
    const execution = await tx.run.findFirst({
      where: { lineageId, kind: "execution" },
      orderBy: { startedAt: "desc" },
    });
    if (!execution)
      throw new WorkbenchError("NOT_FOUND", "Migration not found.", 404);
    const rows = await targetRows(tx);
    const report = reconcile(
      execution.result as unknown as RunResult,
      rows.filter((r) => r._migration_lineage_id === lineageId),
      execution.baselineCount,
      rows.length,
      execution.status === "rolled_back",
    );
    const saved = await tx.reconciliation.create({
      data: {
        id: id(),
        lineageId,
        status: report.status,
        report: json(report),
      },
    });
    await audit(tx, "reconciliation_completed", actor, lineageId, {
      status: report.status,
    });
    return { ...saved, report };
  }
  async reconcile(lineageId: string, actor: string) {
    return this.locked((tx) =>
      this.reconcileTx(tx, lineageId, requireName(actor)),
    );
  }
  async rollback(lineageId: string, requestedBy: string, reason: string) {
    const actor = requireName(requestedBy);
    if (!reason.trim())
      throw new WorkbenchError(
        "REASON_REQUIRED",
        "Provide a rollback reason.",
        400,
      );
    return this.locked(async (tx) => {
      const run = await tx.run.findFirst({
        where: { lineageId, kind: "execution" },
        orderBy: { startedAt: "desc" },
      });
      if (!run)
        throw new WorkbenchError("NOT_FOUND", "Migration not found.", 404);
      if (
        run.status === "running" &&
        Date.now() - run.updatedAt.getTime() < 120000
      )
        throw new WorkbenchError(
          "BUSY",
          "Wait for execution to finish before rollback.",
        );
      const rows = (await targetRows(tx)).filter(
        (r) => r._migration_lineage_id === lineageId,
      );
      const driftedRows = rows.filter(
        (r) => hash(cleanTargetRow(r)) !== r._row_hash,
      ).length;
      if (driftedRows)
        throw new WorkbenchError(
          "CONTENT_DRIFT",
          `${driftedRows} migrated rows changed after insertion. Rollback refused to preserve those edits.`,
        );
      const deleted = await tx.$executeRaw(
        Prisma.sql`DELETE FROM target.customers WHERE _migration_lineage_id=${lineageId}`,
      );
      await tx.run.updateMany({
        where: { lineageId, kind: "execution" },
        data: { status: "rolled_back", finishedAt: new Date() },
      });
      const rollback = await tx.rollback.create({
        data: {
          id: id(),
          lineageId,
          requestedBy: actor,
          reason: reason.trim().slice(0, 500),
          rowsDeleted: deleted,
          driftedRows,
        },
      });
      await audit(tx, "rollback_completed", actor, lineageId, {
        rowsDeleted: deleted,
        reason: rollback.reason,
      });
      await this.reconcileTx(tx, lineageId, actor);
      return rollback;
    });
  }
}
export type WorkbenchState = Awaited<ReturnType<Workbench["state"]>>;
