import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";
export async function getCurrentUser():Promise<SessionUser|null>{const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)return null;try{return await verifySessionToken(token)}catch{return null}}
