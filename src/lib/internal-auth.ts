import { timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function isInternalRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || secret.length < 16 || supplied.length !== secret.length)
    return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function isInternalOrAdminRequest(request: Request) {
  if (isInternalRequest(request)) return true;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;
  try {
    return (await verifySessionToken(token)).role === "admin";
  } catch {
    return false;
  }
}
