import { collections, ensureIndexes, reconcileCustomers } from "./data-store";
import { getDatabase, hasDatabase } from "./mongodb";
import type { Customer, SalesOrder } from "./types";
import type { AnyBulkWriteOperation, Document } from "mongodb";

const rules = [
  {
    offset: 7,
    purpose: "Khảo sát tình trạng sử dụng sau 7 ngày",
    channel: "Gọi điện",
  },
  {
    offset: 25,
    purpose: "Khảo sát liệu trình và mức độ hài lòng",
    channel: "Gọi điện",
  },
  {
    offset: 25,
    purpose: "Nhắc tái mua để duy trì liệu trình",
    channel: "Zalo",
  },
  { offset: 45, purpose: "Duy trì tương tác với khách hàng", channel: "Zalo" },
] as const;

const fixedHolidays = [
  { month: 1, day: 1, purpose: "Chúc mừng năm mới" },
  { month: 3, day: 8, purpose: "Chúc mừng ngày Quốc tế Phụ nữ" },
  { month: 4, day: 30, purpose: "Chăm sóc khách hàng dịp lễ 30/4" },
  { month: 5, day: 1, purpose: "Chăm sóc khách hàng dịp Quốc tế Lao động" },
  { month: 9, day: 2, purpose: "Chăm sóc khách hàng dịp Quốc khánh" },
  { month: 10, day: 20, purpose: "Chúc mừng ngày Phụ nữ Việt Nam" },
  { month: 12, day: 25, purpose: "Chúc mừng Giáng sinh" },
] as const;

const lunarNewYear: Record<number, string> = {
  2026: "02-17",
  2027: "02-06",
  2028: "01-26",
  2029: "02-13",
  2030: "02-03",
  2031: "01-23",
  2032: "02-11",
};

function localDue(year: number, month: number, day: number) {
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00:00+07:00`,
  );
}

function upcomingDates(
  month: number,
  day: number,
  now: Date,
  horizonDays = 60,
) {
  const localYear = Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(now),
  );
  return [
    localDue(localYear, month, day),
    localDue(localYear + 1, month, day),
  ].filter(
    (due) =>
      due.getTime() >= now.getTime() - 86400000 &&
      due.getTime() <= now.getTime() + horizonDays * 86400000,
  );
}

export async function runScheduler() {
  if (!hasDatabase()) return { source: "demo", created: 0, overdue: 0 };
  await ensureIndexes();
  const db = await getDatabase();
  const now = new Date();
  const lockId = "care-scheduler";
  const lock = await db
    .collection(collections.jobLocks)
    .findOneAndUpdate(
      {
        _id: lockId as never,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      {
        $set: {
          expiresAt: new Date(now.getTime() + 4 * 60 * 1000),
          acquiredAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    )
    .catch((error) => {
      if ((error as { code?: number }).code === 11000) return null;
      throw error;
    });
  if (!lock)
    return { source: "mongodb", skipped: "locked", created: 0, overdue: 0 };

  const startedAt = new Date();
  let created = 0,
    birthdayCreated = 0,
    holidayCreated = 0;
  try {
    // All customers share the same calendar dates; construct them once per run.
    const localYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" }).format(now));
    const sharedHolidays = fixedHolidays.flatMap((holiday) => upcomingDates(holiday.month, holiday.day, now).map((due) => ({ due, purpose: holiday.purpose as string, key: `${holiday.month}-${holiday.day}` })));
    for (const year of [localYear, localYear + 1]) {
      const lunar = lunarNewYear[year];
      if (lunar) {
        const [month, day] = lunar.split("-").map(Number);
        sharedHolidays.push(...upcomingDates(month, day, now).filter((due) => due.getFullYear() === year).map((due) => ({ due, purpose: "Chúc Tết khách hàng", key: "tet" })));
      }
    }
    const recentOrderDate = new Date(now.getTime() - 90 * 86400000)
      .toISOString()
      .slice(0, 10);
    const customers = (await db
      .collection(collections.customers)
      .find({}, { projection: { _id: 0 } })
      .toArray()) as unknown as Customer[];
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const customizedTasks = new Set((await db.collection(collections.careTasks)
      .find({ scheduleCustomized: true }, { projection: { id: 1 } }).toArray()).map((task) => task.id));
    const orderOperations: AnyBulkWriteOperation<Document>[] = [];
    const birthdayOperations: AnyBulkWriteOperation<Document>[] = [];
    const holidayOperations: AnyBulkWriteOperation<Document>[] = [];
    const salesOrders = (await db
      .collection(collections.orders)
      .find(
        { status: "Mua hàng", orderDate: { $gte: recentOrderDate } },
        { projection: { _id: 0 } },
      )
      .toArray()) as unknown as SalesOrder[];
    for (const order of salesOrders) {
      const customer = customerMap.get(order.customerId);
      if (!customer) continue;
      for (const rule of rules) {
        const due = new Date(`${order.orderDate}T09:00:00+07:00`);
        due.setUTCDate(due.getUTCDate() + rule.offset);
        const id = `AUTO-${order.id}-${rule.offset}-${rule.purpose.slice(0, 8).replace(/\s/g, "")}`;
        if (customizedTasks.has(id)) continue;
        orderOperations.push({
          updateOne: {
            filter: { id },
            update: {
            $set: {
              customerId: order.customerId,
              customer: customer.name,
              phone: customer.phone,
              purpose: rule.purpose,
              owner: order.owner || customer.owner,
              dueAt: due.toISOString(),
              channel: rule.channel,
              orderId: order.id,
              updatedAt: now.toISOString(),
            },
            $setOnInsert: {
              id,
              status: "due",
              source: "order-rule",
              createdAt: now.toISOString(),
            },
            },
            upsert: true,
          },
        });
      }
    }
    for (const customer of customers) {
      if (customer.birthDate) {
        const match = customer.birthDate.match(/^(?:\d{4})-(\d{2})-(\d{2})$/);
        if (match)
          for (const due of upcomingDates(
            Number(match[1]),
            Number(match[2]),
            now,
          )) {
            const year = due.getFullYear();
            const id = `AUTO-BIRTHDAY-${customer.id}-${year}`;
            birthdayOperations.push({
              updateOne: {
                filter: { id },
                update: {
                $setOnInsert: {
                  id,
                  customerId: customer.id,
                  customer: customer.name,
                  phone: customer.phone,
                  purpose: "Chúc mừng sinh nhật khách hàng",
                  owner: customer.owner,
                  dueAt: due.toISOString(),
                  channel: "Zalo",
                  status: "due",
                  recurrence: "yearly",
                  source: "birthday",
                  createdAt: now.toISOString(),
                },
                },
                upsert: true,
              },
            });
          }
      }
      for (const holiday of sharedHolidays) {
        const year = holiday.due.getFullYear();
        const id = `AUTO-HOLIDAY-${holiday.key}-${customer.id}-${year}`;
        holidayOperations.push({
          updateOne: {
            filter: { id },
            update: {
            $setOnInsert: {
              id,
              customerId: customer.id,
              customer: customer.name,
              phone: customer.phone,
              purpose: holiday.purpose,
              owner: customer.owner,
              dueAt: holiday.due.toISOString(),
              channel: "Zalo",
              status: "due",
              recurrence: "yearly",
              source: "holiday",
              createdAt: now.toISOString(),
            },
            },
            upsert: true,
          },
        });
      }
    }
    async function runBulk(operations: AnyBulkWriteOperation<Document>[]) {
      let upserted = 0;
      for (let offset = 0; offset < operations.length; offset += 500) {
        const result = await db
          .collection(collections.careTasks)
          .bulkWrite(operations.slice(offset, offset + 500), { ordered: false });
        upserted += result.upsertedCount;
      }
      return upserted;
    }
    [created, birthdayCreated, holidayCreated] = await Promise.all([
      runBulk(orderOperations),
      runBulk(birthdayOperations),
      runBulk(holidayOperations),
    ]);
    created += birthdayCreated + holidayCreated;
    const overdueResult = await db
      .collection(collections.careTasks)
      .updateMany(
        { status: "due", dueAt: { $lt: now.toISOString() } },
        { $set: { status: "overdue", updatedAt: now.toISOString() } },
      );
    const reconciliation = await reconcileCustomers();
    const outcome = {
      source: "mongodb",
      created,
      birthdayCreated,
      holidayCreated,
      overdue: overdueResult.modifiedCount,
      customersUpdated: reconciliation.updated,
    };
    await db.collection(collections.jobRuns).insertOne({
      job: lockId,
      startedAt,
      finishedAt: new Date(),
      status: "success",
      ...outcome,
    });
    return outcome;
  } catch (error) {
    await db.collection(collections.jobRuns).insertOne({
      job: lockId,
      startedAt,
      finishedAt: new Date(),
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  } finally {
    await db
      .collection(collections.jobLocks)
      .deleteOne({ _id: lockId as never });
  }
}
