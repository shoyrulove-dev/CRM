import { collections, ensureIndexes } from "./data-store";
import { getDatabase, hasDatabase } from "./mongodb";
import type { SalesOrder } from "./types";

const rules = [
  { offset: 7, purpose: "Khảo sát tình trạng sử dụng sau 7 ngày", channel: "Gọi điện" },
  { offset: 25, purpose: "Khảo sát liệu trình và mức độ hài lòng", channel: "Gọi điện" },
  { offset: 25, purpose: "Nhắc tái mua để duy trì liệu trình", channel: "Zalo" },
  { offset: 45, purpose: "Duy trì tương tác với khách hàng", channel: "Zalo" },
] as const;

export async function runScheduler() {
  if (!hasDatabase()) return { source: "demo", created: 0, overdue: 0 };
  await ensureIndexes();
  const db = await getDatabase();
  const now = new Date();
  const lockId = "care-scheduler";
  const lock = await db.collection(collections.jobLocks).findOneAndUpdate(
    { _id: lockId as never, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
    { $set: { expiresAt: new Date(now.getTime() + 4 * 60 * 1000), acquiredAt: now } },
    { upsert: true, returnDocument: "after" },
  ).catch(error => { if ((error as { code?: number }).code === 11000) return null; throw error; });
  if (!lock) return { source: "mongodb", skipped: "locked", created: 0, overdue: 0 };

  const startedAt = new Date();
  let created = 0;
  try {
    const salesOrders = await db.collection(collections.orders).find({ status: "Mua hàng" }, { projection: { _id: 0 } }).toArray() as unknown as SalesOrder[];
    for (const order of salesOrders) {
      const customer = await db.collection(collections.customers).findOne({ id: order.customerId });
      if (!customer) continue;
      for (const rule of rules) {
        const due = new Date(`${order.orderDate}T09:00:00+07:00`);
        due.setUTCDate(due.getUTCDate() + rule.offset);
        const id = `AUTO-${order.id}-${rule.offset}-${rule.purpose.slice(0, 8).replace(/\s/g, "")}`;
        const result = await db.collection(collections.careTasks).updateOne({ id }, { $setOnInsert: { id, customerId: order.customerId, customer: customer.name, phone: customer.phone, purpose: rule.purpose, owner: order.owner || customer.owner, dueAt: due.toISOString(), channel: rule.channel, status: "due", source: "order-rule", orderId: order.id, createdAt: now.toISOString() } }, { upsert: true });
        created += result.upsertedCount;
      }
    }
    const overdueResult = await db.collection(collections.careTasks).updateMany({ status: "due", dueAt: { $lt: now.toISOString() } }, { $set: { status: "overdue", updatedAt: now.toISOString() } });
    const outcome = { source: "mongodb", created, overdue: overdueResult.modifiedCount };
    await db.collection(collections.jobRuns).insertOne({ job: lockId, startedAt, finishedAt: new Date(), status: "success", ...outcome });
    return outcome;
  } catch (error) {
    await db.collection(collections.jobRuns).insertOne({ job: lockId, startedAt, finishedAt: new Date(), status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    throw error;
  } finally {
    await db.collection(collections.jobLocks).deleteOne({ _id: lockId as never });
  }
}
