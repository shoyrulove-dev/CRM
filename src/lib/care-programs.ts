import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "./mongodb";
import { collections } from "./data-store";
import { nextCareDate, type Recurrence } from "./care-recurrence";

export const PROGRAMS = "care_programs";
export interface CareProgram {
  id: string; purpose: string; channel: string; owner: string; assignToCustomerOwner: boolean;
  product: string; filterOwner: string; customerIds: string[]; targetCount: number;
  nextDueAt: string; recurrence: Recurrence; intervalDays: number; anchorDay: number; endDate: string;
  status: "active" | "paused" | "ended" | "completed"; cursor: number;
  created: number; skipped: number; occurrence: number; createdAt: string; createdBy: string;
  leaseUntil?: Date; leaseOwner?: string; error?: string;
}
export async function programCustomers(input: { filterOwner?: string; product?: string }) {
  const db = await getDatabase();
  const filter: Record<string, unknown> = {};
  if (input.filterOwner) filter.owner = input.filterOwner;
  if (input.product) {
    const catalog = await import("./data-store").then(module => module.listProductCatalog());
    const sku = catalog.find(item => item.name === input.product)?.sku;
    filter.id = { $in: await db.collection(collections.orders).distinct("customerId", {
      status: "Mua hàng", $or: [...(sku ? [{ "products.sku": sku }] : []), { "products.name": { $regex: input.product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }],
    }) };
  }
  return db.collection(collections.customers).find(filter, { projection: { id: 1, owner: 1 } }).sort({ id: 1 }).toArray();
}
export async function processCareProgram(id: string) {
  const db = await getDatabase(), col = db.collection<CareProgram>(PROGRAMS), now = new Date(), leaseOwner = randomUUID();
  const program = await col.findOneAndUpdate({ id, status: "active", nextDueAt: { $lte: new Date(now.getTime() + 30 * 86400000).toISOString() },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
  { $set: { leaseUntil: new Date(now.getTime() + 120000), leaseOwner } }, { returnDocument: "after" });
  if (!program) return { busy: true, processed: 0 };
  try {
    const ids = program.customerIds.slice(program.cursor, program.cursor + 200);
    const customers = await db.collection(collections.customers).find({ id: { $in: ids } }).project({ id: 1, name: 1, phone: 1, owner: 1 }).toArray();
    let created = 0;
    if (customers.length) {
      const result = await db.collection(collections.careTasks).bulkWrite(customers.map(customer => {
        const taskId = `PROG-${createHash("sha256").update(`${customer.id}|${program.nextDueAt}|${program.purpose}|${program.channel}`).digest("hex").slice(0, 32)}`;
        return { updateOne: { filter: { id: taskId }, update: { $setOnInsert: {
          id: taskId, customerId: customer.id, customer: customer.name, phone: customer.phone,
          owner: program.assignToCustomerOwner ? customer.owner : program.owner,
          purpose: program.purpose, channel: program.channel, dueAt: program.nextDueAt,
          status: program.nextDueAt < now.toISOString() ? "overdue" : "due", recurrence: "none",
          source: "manual", programId: program.id, bulkCreated: true, createdAt: now.toISOString(),
        } }, upsert: true } };
      }), { ordered: false });
      created = result.upsertedCount;
    }
    const cursor = program.cursor + ids.length;
    const update: Partial<CareProgram> = { cursor, created: program.created + created, skipped: program.skipped + ids.length - created, error: "" };
    if (cursor >= program.targetCount) {
      let next = nextCareDate(program.nextDueAt, program.recurrence, program.intervalDays, program.anchorDay);
      // Do not generate years of missed recurring jobs after a paused program resumes.
      for (let i = 0; next && next < now.toISOString() && i < 10000; i++) next = nextCareDate(next, program.recurrence, program.intervalDays, program.anchorDay);
      if (!next || (program.endDate && next.slice(0, 10) > program.endDate)) update.status = "completed";
      else { update.nextDueAt = next; update.cursor = 0; update.occurrence = program.occurrence + 1; }
    }
    await col.updateOne({ id, leaseOwner }, { $set: update });
    return { busy: false, processed: ids.length, created, remaining: Math.max(0, program.targetCount - cursor) };
  } catch (error) {
    await col.updateOne({ id, leaseOwner }, { $set: { error: error instanceof Error ? error.message : "Chưa tạo xong lịch." } });
    throw error;
  } finally { await col.updateOne({ id, leaseOwner }, { $unset: { leaseOwner: "", leaseUntil: "" } }); }
}
export async function runCarePrograms() {
  const db = await getDatabase();
  const programs = await db.collection(PROGRAMS).find({ status: "active", nextDueAt: { $lte: new Date(Date.now() + 30 * 86400000).toISOString() } }).sort({ createdAt: 1 }).limit(5).project({ id: 1 }).toArray();
  for (const program of programs) await processCareProgram(String(program.id));
}
