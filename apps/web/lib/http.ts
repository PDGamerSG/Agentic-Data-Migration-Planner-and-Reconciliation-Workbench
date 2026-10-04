import type { NextRequest } from "next/server";
/** Next's internal URL can use 0.0.0.0; validate the externally routed Host. */
export function sameOrigin(request: NextRequest): boolean {
  const value = request.headers.get("origin");
  if (!value) return false;
  try {
    const origin = new URL(value);
    return (
      origin.host === request.headers.get("host") &&
      ["http:", "https:"].includes(origin.protocol)
    );
  } catch {
    return false;
  }
}
