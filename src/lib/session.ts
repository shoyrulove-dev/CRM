import { jwtVerify, SignJWT } from "jose";
import type { PermissionKey, UserRole } from "./types";

export const SESSION_COOKIE = "nichiei_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: PermissionKey[];
  canManageUsers?: boolean;
  sessionVersion?: number;
}

function secretKey() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production")
      throw new Error("SESSION_SECRET must contain at least 32 characters");
    return new TextEncoder().encode(
      "local-development-session-secret-change-me",
    );
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as unknown as SessionUser;
}

export function canSeeAll(user: SessionUser | null) {
  return user?.role === "admin" || user?.role === "super_admin";
}
export function roleLabel(role: UserRole) {
  return role === "super_admin"
    ? "Super admin"
    : role === "admin"
    ? "Quản trị viên"
    : role === "sales"
      ? "Nhân viên bán hàng"
      : "Chăm sóc khách hàng";
}
export function hasPermission(user: SessionUser | null, key: PermissionKey) {
  if (!user) return false;
  return (
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    !user?.permissions ||
    user.permissions.includes(key)
  );
}
