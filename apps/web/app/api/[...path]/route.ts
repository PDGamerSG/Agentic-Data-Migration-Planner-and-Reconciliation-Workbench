import { sameOrigin } from "@/lib/http";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Workbench, WorkbenchError } from "@manifest/db";
import { planSpecSchema } from "@manifest/core";
import { answersSchema } from "@manifest/agent";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const actor = z.string().trim().min(1).max(100);
const identifier = z.uuid();
const schemas = {
  agent: z
    .object({
      answers: answersSchema.default({}),
      basePlanId: identifier.optional(),
    })
    .strict(),
  plans: z
    .object({
      parentId: identifier,
      spec: planSpecSchema,
      authorName: actor,
      changeSummary: z.string().min(1).max(500),
    })
    .strict(),
  dry: z.object({ planId: identifier, startedBy: actor }).strict(),
  approve: z
    .object({
      planId: identifier,
      dryRunId: identifier,
      specHash: z.string().regex(/^[a-f0-9]{64}$/),
      approvedBy: actor,
      acknowledgedRisks: z.array(z.string()).max(30),
      comment: z.string().max(500).optional(),
    })
    .strict(),
  execute: z
    .object({
      planId: identifier,
      startedBy: actor,
      failAfterBatch: z.number().int().min(1).max(20).optional(),
    })
    .strict(),
  reconcile: z.object({ lineageId: identifier, actor }).strict(),
  rollback: z
    .object({
      lineageId: identifier,
      requestedBy: actor,
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
};
function failure(error: unknown) {
  if (error instanceof WorkbenchError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
      },
      { status: 400 },
    );
  console.error(
    "Workbench request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    {
      error: {
        code: "SERVER_ERROR",
        message: process.env.DATABASE_URL
          ? "The operation could not complete. Check the database migrations and server logs."
          : "Add DATABASE_URL to .env, then run pnpm db:deploy and pnpm db:seed.",
      },
    },
    { status: 503 },
  );
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (path[0] === "health") return NextResponse.json({ status: "ok" });
    const wb = new Workbench();
    if (path.join("/") === "state")
      return NextResponse.json(await wb.state(), {
        headers: { "Cache-Control": "no-store" },
      });
    if (path[0] === "runs" && path.length === 2)
      return NextResponse.json(await wb.getRun(identifier.parse(path[1])));
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Endpoint not found" } },
      { status: 404 },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    if (!sameOrigin(request))
      throw new WorkbenchError(
        "INVALID_ORIGIN",
        "Request origin must match this workbench.",
        403,
      );
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 1048576)
      throw new WorkbenchError(
        "PAYLOAD_TOO_LARGE",
        "Request exceeds 1 MB.",
        413,
      );
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new WorkbenchError(
        "INVALID_JSON",
        "Request must be valid JSON.",
        400,
      );
    }
    const { path } = await params;
    const action = path.join("/");
    const wb = new Workbench();
    let result: unknown;
    switch (action) {
      case "agent": {
        const v = schemas.agent.parse(body);
        const session = await wb.createSession(v.answers, v.basePlanId);
        after(() => wb.processSession(session.id, v.basePlanId));
        result = session;
        break;
      }
      case "plans":
        result = await wb.savePlan(schemas.plans.parse(body));
        break;
      case "dry-run": {
        const v = schemas.dry.parse(body);
        result = await wb.dryRun(v.planId, v.startedBy);
        break;
      }
      case "approve":
        result = await wb.approve(schemas.approve.parse(body));
        break;
      case "execute": {
        const v = schemas.execute.parse(body);
        result = await wb.execute(v.planId, v.startedBy, v.failAfterBatch);
        break;
      }
      case "reconcile": {
        const v = schemas.reconcile.parse(body);
        result = await wb.reconcile(v.lineageId, v.actor);
        break;
      }
      case "rollback": {
        const v = schemas.rollback.parse(body);
        result = await wb.rollback(v.lineageId, v.requestedBy, v.reason);
        break;
      }
      default:
        throw new WorkbenchError("NOT_FOUND", "Endpoint not found.", 404);
    }
    return NextResponse.json(result, {
      status: action === "agent" ? 202 : 200,
    });
  } catch (error) {
    return failure(error);
  }
}
