import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";
import{getDatabase,hasDatabase}from"./mongodb";import{collections}from"./data-store";import type{PermissionGroup,UserAccount}from"./types";
export async function getCurrentUser():Promise<SessionUser|null>{const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)return null;try{const session=await verifySessionToken(token);if(!hasDatabase()||session.role==='admin')return session;const db=await getDatabase(),account=await db.collection<UserAccount>(collections.users).findOne({id:session.id,active:true});if(!account)return null;if(!account.groupId)return session;const group=await db.collection<PermissionGroup>(collections.permissionGroups).findOne({id:account.groupId});return{...session,permissions:group?.permissions||[]}}catch{return null}}
