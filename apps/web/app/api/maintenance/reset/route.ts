import { createHash, timingSafeEqual } from "node:crypto";
import { getDb, resetDemoWorkspace, WorkbenchError } from "@manifest/db";
import { sameOrigin } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Temporary, single-use maintenance access for the explicitly authorized cleanup.
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = createHash("sha256")
    .update(authorization.startsWith("Bearer ") ? authorization.slice(7) : "")
    .digest();
  const expected = Buffer.from(
    "bb63eab22bc675ccb181e9094becf43f0178932d9a95eb298325f2796bd6d12c",
    "hex",
  );
  if (
    Date.now() > 1791268008348 ||
    !sameOrigin(request) ||
    !timingSafeEqual(supplied, expected)
  )
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Endpoint not found" } },
      { status: 404 },
    );
  try {
    const result = await resetDemoWorkspace(
      getDb(),
      "8b8825d3-9c8d-44e7-96e3-937a1ee957b5",
    );
    console.info(JSON.stringify({ event: "demo_workspace_reset", ...result }));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof WorkbenchError)
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    console.error(
      JSON.stringify({
        event: "demo_reset_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return NextResponse.json(
      {
        error: {
          code: "RESET_FAILED",
          message: "Maintenance did not complete.",
        },
      },
      { status: 500 },
    );
  }
}
