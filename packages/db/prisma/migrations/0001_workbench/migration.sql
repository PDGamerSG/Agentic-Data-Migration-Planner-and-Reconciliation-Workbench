-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "records" JSONB NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "parentId" TEXT,
    "authorName" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "specHash" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "proposal" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "agentSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "dryRunId" TEXT NOT NULL,
    "specHash" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "acknowledgedRisks" JSONB NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "specHash" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "targetKeysHash" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "retryOfId" TEXT,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "baselineCount" INTEGER NOT NULL,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedExisting" INTEGER NOT NULL DEFAULT 0,
    "batchesCommitted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "proposal" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tool" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "rejected" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rollback" (
    "id" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "rowsDeleted" INTEGER NOT NULL,
    "driftedRows" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rollback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_version_key" ON "PlanVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_planVersionId_key" ON "Approval"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_dryRunId_key" ON "Approval"("dryRunId");

-- CreateIndex
CREATE INDEX "Run_lineageId_idx" ON "Run"("lineageId");

-- CreateIndex
CREATE INDEX "Run_planVersionId_kind_idx" ON "Run"("planVersionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolCall_sessionId_seq_key" ON "AgentToolCall"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "AuditEvent_entityId_idx" ON "AuditEvent"("entityId");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE SCHEMA target;
CREATE TABLE target.customers (
  id BIGSERIAL PRIMARY KEY,
  legacy_id TEXT UNIQUE CHECK (legacy_id IS NULL OR char_length(legacy_id) BETWEEN 1 AND 100),
  first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name TEXT CHECK (char_length(last_name) <= 100),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND char_length(email) <= 254),
  phone_e164 TEXT CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'vip')),
  country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  postal_code TEXT CHECK (char_length(postal_code) <= 12),
  credit_limit_cents INTEGER NOT NULL CHECK (credit_limit_cents >= 0),
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL,
  marketing_opt_in BOOLEAN NOT NULL,
  _migration_lineage_id TEXT,
  _row_hash TEXT,
  _loaded_at TIMESTAMPTZ,
  CHECK ((_migration_lineage_id IS NULL AND _row_hash IS NULL) OR (_migration_lineage_id IS NOT NULL AND _row_hash IS NOT NULL AND legacy_id IS NOT NULL))
);
CREATE INDEX customers_lineage_idx ON target.customers (_migration_lineage_id);
CREATE UNIQUE INDEX one_running_execution ON "Run" ((kind)) WHERE kind = 'execution' AND status = 'running';
CREATE FUNCTION prevent_history_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History is append-only'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON "AuditEvent" FOR EACH STATEMENT EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER plans_immutable BEFORE UPDATE OR DELETE ON "PlanVersion" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER approvals_immutable BEFORE UPDATE OR DELETE ON "Approval" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
