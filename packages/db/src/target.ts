import { targetSchema } from "@manifest/fixtures";
import type { Scalar } from "@manifest/core";
import { Prisma } from "./generated/prisma/client";
import type { Tx } from "./client";
export type TargetRow = Record<string, Scalar> & {
  id: number;
  _migration_lineage_id: string | null;
  _row_hash: string | null;
};
export async function targetRows(
  db: Tx,
  excludeLineage?: string,
): Promise<TargetRow[]> {
  const rows = await db.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`SELECT c.*, to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at, c.date_of_birth::text AS date_of_birth, to_char(c._loaded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS _loaded_at FROM target.customers c ORDER BY id`,
  );
  return rows
    .filter(
      (r) => !excludeLineage || r._migration_lineage_id !== excludeLineage,
    )
    .map((r) => {
      const normalized: Record<string, Scalar> = {};
      for (const [key, value] of Object.entries(r))
        normalized[key] =
          value instanceof Date
            ? key === "date_of_birth"
              ? value.toISOString().slice(0, 10)
              : value.toISOString()
            : typeof value === "bigint"
              ? Number(value)
              : (value as Scalar);
      return normalized as TargetRow;
    });
}
export const targetKeys = (rows: TargetRow[]) => ({
  emails: rows.map((r) => String(r.email)),
  legacyIds: rows
    .filter((r) => r.legacy_id !== null)
    .map((r) => String(r.legacy_id)),
});
export const cleanTargetRow = (row: TargetRow) =>
  Object.fromEntries(
    targetSchema.fields.map((f) => [f.name, row[f.name] ?? null]),
  );
export async function insertTarget(
  db: Tx,
  row: Record<string, Scalar>,
  lineage: string | null,
  rowHash: string | null,
) {
  const inserted = await db.$queryRaw<{ legacy_id: string }[]>(Prisma.sql`
    INSERT INTO target.customers (legacy_id,first_name,last_name,email,phone_e164,status,tier,country_code,postal_code,credit_limit_cents,date_of_birth,created_at,marketing_opt_in,_migration_lineage_id,_row_hash,_loaded_at)
    VALUES (${row.legacy_id},${row.first_name},${row.last_name},${row.email},${row.phone_e164},${row.status},${row.tier},${row.country_code},${row.postal_code},${row.credit_limit_cents},CAST(${row.date_of_birth} AS date),CAST(${row.created_at} AS timestamptz),${row.marketing_opt_in},${lineage},${rowHash},CASE WHEN ${lineage}::text IS NULL THEN NULL ELSE now() END)
    ON CONFLICT (legacy_id) DO NOTHING RETURNING legacy_id
  `);
  return inserted.length;
}

/** One network round trip for up to fifty deterministic outcomes. */
export async function insertTargetBatch(
  db: Tx,
  outcomes: import("@manifest/core").RecordOutcome[],
  lineage: string,
) {
  const payload = JSON.stringify(
    outcomes.map((o) => ({ ...o.row, _row_hash: o.rowHash })),
  );
  return db.$queryRaw<{ legacy_id: string }[]>(Prisma.sql`
    INSERT INTO target.customers (legacy_id,first_name,last_name,email,phone_e164,status,tier,country_code,postal_code,credit_limit_cents,date_of_birth,created_at,marketing_opt_in,_migration_lineage_id,_row_hash,_loaded_at)
    SELECT r.legacy_id,r.first_name,r.last_name,r.email,r.phone_e164,r.status,r.tier,r.country_code,r.postal_code,r.credit_limit_cents,r.date_of_birth::date,r.created_at::timestamptz,r.marketing_opt_in,${lineage},r._row_hash,now()
    FROM jsonb_to_recordset(${payload}::jsonb) AS r(legacy_id text,first_name text,last_name text,email text,phone_e164 text,status text,tier text,country_code text,postal_code text,credit_limit_cents integer,date_of_birth text,created_at text,marketing_opt_in boolean,_row_hash text)
    ON CONFLICT (legacy_id) DO NOTHING RETURNING legacy_id
  `);
}
