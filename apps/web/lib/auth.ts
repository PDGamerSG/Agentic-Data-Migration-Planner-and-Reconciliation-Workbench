const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must have at least 32 characters");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function sessionToken() {
  const expires = String(Date.now() + 7 * 86400000);
  return `${expires}.${hex(await crypto.subtle.sign("HMAC", await key(), encoder.encode(expires)))}`;
}
export async function validSession(token: string) {
  try {
    const [expires, signature] = token.split(".");
    if (
      !expires ||
      !signature ||
      !/^\d+$/.test(expires) ||
      !/^[0-9a-f]{64}$/.test(signature) ||
      Number(expires) < Date.now()
    )
      return false;
    const bytes = new Uint8Array(
      signature.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );
    return await crypto.subtle.verify(
      "HMAC",
      await key(),
      bytes,
      encoder.encode(expires),
    );
  } catch {
    return false;
  }
}
