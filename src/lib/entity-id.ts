import { randomUUID } from "node:crypto";
export function createEntityId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}
