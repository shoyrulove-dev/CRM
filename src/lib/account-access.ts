import type { SessionUser } from "./session";
import type { UserAccount, UserRole } from "./types";

export function canOpenAccounts(user: SessionUser | null) {
  return Boolean(
    user &&
      (user.role === "super_admin" ||
        (user.role === "admin" && user.canManageUsers)),
  );
}

export function canCreateRole(user: SessionUser, role: UserRole) {
  if (user.role === "super_admin") return role !== "super_admin";
  return user.role === "admin" && user.canManageUsers && ["sales", "care"].includes(role);
}

export function canManageAccount(user: SessionUser, target: Pick<UserAccount, "role">) {
  if (user.role === "super_admin") return target.role !== "super_admin";
  return (
    user.role === "admin" &&
    user.canManageUsers &&
    ["sales", "care"].includes(target.role)
  );
}
