import { NextResponse, type NextRequest } from "next/server";
import { validSession } from "./lib/auth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/auth" || path === "/api/health")
    return NextResponse.next();
  if (process.env.VERCEL && !process.env.APP_ACCESS_CODE)
    return NextResponse.json(
      {
        error: {
          code: "ACCESS_NOT_CONFIGURED",
          message:
            "Set APP_ACCESS_CODE and SESSION_SECRET before publishing this workbench.",
        },
      },
      { status: 503 },
    );
  if (!process.env.APP_ACCESS_CODE) return NextResponse.next();
  if (await validSession(request.cookies.get("manifest_session")?.value ?? ""))
    return NextResponse.next();
  if (path.startsWith("/api/"))
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to the workbench." } },
      { status: 401 },
    );
  return NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
