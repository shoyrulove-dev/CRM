import "server-only";
import { collections } from "./data-store";
import { getDatabase, hasDatabase } from "./mongodb";
import type { SessionUser } from "./session";
export async function writeAudit(
  user: SessionUser | null,
  action: string,
  entity: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  if (!hasDatabase()) return;
  await (await getDatabase()).collection(collections.auditLogs).insertOne({
    userId: user?.id || "system",
    userName: user?.name || "Hệ thống",
    action,
    entity,
    entityId,
    before: before || null,
    after: after || null,
    createdAt: new Date().toISOString(),
  });
}
