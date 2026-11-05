import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "nichiei_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "leader" | "staff";
}

function secretKey() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must contain at least 32 characters");
    return new TextEncoder().encode("local-development-session-secret-change-me");
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
