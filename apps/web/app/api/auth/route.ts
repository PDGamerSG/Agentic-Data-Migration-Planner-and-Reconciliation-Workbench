import { sameOrigin } from "@/lib/http";
import { timingSafeEqual, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sessionToken } from "@/lib/auth";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: { message: "Invalid request origin" } },
      { status: 403 },
    );
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until < now) attempts.delete(key);
  const entry = attempts.get(ip) ?? { count: 0, until: now + 15 * 60000 };
  if (++entry.count > 10)
    return NextResponse.json(
      { error: { message: "Too many attempts. Try in 15 minutes." } },
      { status: 429 },
    );
  attempts.set(ip, entry);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid request" } },
      { status: 400 },
    );
  }
  const code =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code
      : "";
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected)
    return NextResponse.json(
      { error: { message: "Access code is not configured" } },
      { status: 503 },
    );
  if (
    !timingSafeEqual(
      createHash("sha256").update(code).digest(),
      createHash("sha256").update(expected).digest(),
    )
  )
    return NextResponse.json(
      { error: { message: "Incorrect access code" } },
      { status: 401 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set("manifest_session", await sessionToken(), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "strict",
    maxAge: 7 * 86400,
    path: "/",
  });
  attempts.delete(ip);
  return response;
}
