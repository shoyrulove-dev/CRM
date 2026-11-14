import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionUser,
} from "./session";
import { getDatabase, hasDatabase } from "./mongodb";
import { collections } from "./data-store";
import type { PermissionGroup, UserAccount } from "./types";
import { cache } from "react";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const session = await verifySessionToken(token);
    if (!hasDatabase()) return session;
    const db = await getDatabase();
    const account = await db
      .collection<UserAccount>(collections.users)
      .findOne({ id: session.id, active: true });
    if (
      !account ||
      (account.sessionVersion || 0) !== (session.sessionVersion || 0)
    )
      return null;
    let permissions = session.permissions;
    if (!["admin", "super_admin"].includes(account.role) && account.groupId) {
      const group = await db
        .collection<PermissionGroup>(collections.permissionGroups)
        .findOne({ id: account.groupId });
      permissions = group?.permissions || [];
    }
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      sessionVersion: account.sessionVersion || 0,
      permissions,
      canManageUsers: account.role === "super_admin" || Boolean(account.canManageUsers),
    };
  } catch {
    return null;
  }
});
