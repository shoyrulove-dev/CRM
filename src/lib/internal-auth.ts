import { timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "./current-user";

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
  const user = await getCurrentUser();
  return Boolean(user && !user.mustChangePassword && ["admin", "super_admin"].includes(user.role));
}
