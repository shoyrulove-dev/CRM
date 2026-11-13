import { activities, customers, orders, tasks, tickets } from "./demo-data";
import { getDatabase, hasDatabase } from "./mongodb";
import type {
  CareActivity,
  CareTask,
  Customer,
  SalesOrder,
  ServiceTicket,
  ProductOption,
} from "./types";
import type { SessionUser } from "./session";

export const collections = {
  customers: "customers",
  careTasks: "care_tasks",
  careActivities: "care_activities",
  tickets: "service_tickets",
  orders: "orders",
  syncEvents: "sync_events",
  auditLogs: "audit_logs",
  jobLocks: "job_locks",
  jobRuns: "job_runs",
  users: "users",
  settings: "settings",
  permissionGroups: "permission_groups",
  loginAttempts: "login_attempts",
  notificationReads: "notification_reads",
  loginEvents: "login_events",
} as const;

export async function ensureIndexes() {
  if (!hasDatabase()) return false;
  const db = await getDatabase();
  await Promise.all([
    db
      .collection(collections.customers)
      .createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.customers).createIndex({ phone: 1 }),
    db
      .collection(collections.customers)
      .createIndex({ haravanId: 1 }, { unique: true, sparse: true }),
    db.collection(collections.customers).createIndex({ owner: 1, name: 1 }),
    db
      .collection(collections.careTasks)
      .createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.careTasks).createIndex({ status: 1, dueAt: 1 }),
    db
      .collection(collections.careTasks)
      .createIndex({ owner: 1, status: 1, dueAt: 1 }),
    db
      .collection(collections.careActivities)
      .createIndex({ customerId: 1, occurredAt: -1 }),
    db.collection(collections.tickets).createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.tickets).createIndex({ owner: 1, createdAt: -1 }),
    db
      .collection(collections.orders)
      .createIndex({ code: 1 }, { unique: true }),
    db
      .collection(collections.orders)
      .createIndex({ haravanId: 1 }, { unique: true, sparse: true }),
    db
      .collection(collections.orders)
      .createIndex({ customerId: 1, orderDate: -1 }),
    db.collection(collections.orders).createIndex({ owner: 1, orderDate: -1 }),
    db
      .collection(collections.syncEvents)
      .createIndex({ externalId: 1, topic: 1 }, { unique: true, sparse: true }),
    db
      .collection(collections.jobLocks)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(collections.jobRuns).createIndex({ startedAt: -1 }),
    db
      .collection(collections.users)
      .createIndex({ email: 1 }, { unique: true }),
    db
      .collection(collections.loginAttempts)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db
      .collection(collections.notificationReads)
      .createIndex({ userId: 1, taskId: 1 }, { unique: true }),
    db.collection(collections.loginEvents).createIndex({ createdAt: -1 }),
    db
      .collection(collections.loginEvents)
      .createIndex({ userId: 1, createdAt: -1 }),
    db
      .collection(collections.tickets)
      .createIndex({ owner: 1, status: 1, createdAt: -1 }),
    db
      .collection(collections.orders)
      .createIndex({ "products.sku": 1, orderDate: -1 }),
  ]);
  return true;
}

export async function seedDemoData() {
  if (!hasDatabase()) throw new Error("MONGODB_URI is not configured");
  const db = await getDatabase();
  await ensureIndexes();
  const batches: Array<
    [
      string,
      Array<Customer | CareTask | CareActivity | ServiceTicket | SalesOrder>,
    ]
  > = [
    [collections.customers, customers],
    [collections.careTasks, tasks],
    [collections.careActivities, activities],
    [collections.tickets, tickets],
    [collections.orders, orders],
  ];
  for (const [name, documents] of batches) {
    for (const document of documents)
      await db
        .collection(name)
        .updateOne({ id: document.id }, { $set: document }, { upsert: true });
  }
  return Object.fromEntries(batches.map(([name, docs]) => [name, docs.length]));
}

async function listFromMongo<T>(collection: string, filter = {}, sort = {}) {
  const db = await getDatabase();
  return db
    .collection(collection)
    .find(filter, { projection: { _id: 0 } })
    .sort(sort)
    .toArray() as unknown as T[];
}

export async function listProductCatalog(): Promise<ProductOption[]> {
  if (!hasDatabase()) {
    const map = new Map<string, ProductOption>();
    orders.flatMap((order) => order.products).forEach((product) => {
      if (product.sku) map.set(product.sku, { sku: product.sku, name: product.name });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }
  const rows = await (await getDatabase()).collection(collections.orders).aggregate([
    { $unwind: "$products" },
    { $match: { "products.sku": { $type: "string", $ne: "" } } },
    { $sort: { orderDate: -1 } },
    { $group: { _id: "$products.sku", name: { $first: "$products.name" } } },
    { $project: { _id: 0, sku: "$_id", name: 1 } },
    { $sort: { name: 1 } },
  ]).toArray();
  return rows as ProductOption[];
}

export async function listCustomers(
  search?: string,
  user?: SessionUser | null,
): Promise<Customer[]> {
  if (!hasDatabase())
    return customers.filter(
      (c) =>
        (!user || user.role === "admin" || c.owner === user.name) &&
        (!search ||
          `${c.name} ${c.phone} ${c.id}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    );
  const clauses: Record<string, unknown>[] = [];
  if (search)
    clauses.push({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } },
      ],
    });
  if (user && user.role !== "admin") clauses.push({ owner: user.name });
  const filter = clauses.length ? { $and: clauses } : {};
  return listFromMongo<Customer>(collections.customers, filter, { name: 1 });
}

export async function getCustomersPage(
  input: {
    search?: string;
    owner?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  },
  user?: SessionUser | null,
) {
  const page = Math.max(1, input.page || 1),
    size = Math.min(100, Math.max(1, input.size || 20));
  if (!hasDatabase()) {
    const filtered = customers.filter(
      (item) =>
        (!user || user.role === "admin" || item.owner === user.name) &&
        (!input.search ||
          `${item.name} ${item.phone} ${item.id}`
            .toLowerCase()
            .includes(input.search.toLowerCase())) &&
        (!input.owner || item.owner === input.owner) &&
        (!input.status || item.status === input.status) &&
        (!input.from || item.lastOrder >= input.from) &&
        (!input.to || item.lastOrder <= input.to),
    );
    return {
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
      totalRevenue: filtered.reduce((sum, item) => sum + item.revenue, 0),
      totalOrders: filtered.reduce((sum, item) => sum + item.orders, 0),
    };
  }
  const filter: Record<string, unknown> = {};
  if (user && user.role !== "admin") filter.owner = user.name;
  else if (input.owner) filter.owner = input.owner;
  if (input.status) filter.status = input.status;
  if (input.from || input.to)
    filter.lastOrder = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  if (input.search)
    filter.$or = [
      { name: { $regex: input.search, $options: "i" } },
      { phone: { $regex: input.search, $options: "i" } },
      { id: { $regex: input.search, $options: "i" } },
    ];
  const db = await getDatabase();
  const [items, totals] = await Promise.all([
    db
      .collection(collections.customers)
      .find(filter, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .skip((page - 1) * size)
      .limit(size)
      .toArray(),
    db
      .collection(collections.customers)
      .aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalRevenue: { $sum: "$revenue" },
            totalOrders: { $sum: "$orders" },
          },
        },
      ])
      .next(),
  ]);
  return {
    items: items as unknown as Customer[],
    total: Number(totals?.total || 0),
    totalRevenue: Number(totals?.totalRevenue || 0),
    totalOrders: Number(totals?.totalOrders || 0),
  };
}

export async function getCustomerProfile(
  id: string,
  user?: SessionUser | null,
) {
  if (!hasDatabase())
    return {
      customer: customers.find((c) => c.id === id) || null,
      activities: activities.filter((a) => a.customerId === id),
      orders: orders.filter((o) => o.customerId === id),
      tickets: tickets.filter((t) => t.customerId === id),
      tasks: tasks.filter((t) => t.customerId === id),
    };
  const db = await getDatabase();
  const [
    customer,
    customerActivities,
    customerOrders,
    customerTickets,
    customerTasks,
  ] = await Promise.all([
    db
      .collection(collections.customers)
      .findOne({ id }, { projection: { _id: 0 } }),
    listFromMongo<CareActivity>(
      collections.careActivities,
      { customerId: id },
      { occurredAt: -1 },
    ),
    listFromMongo<SalesOrder>(
      collections.orders,
      { customerId: id },
      { orderDate: -1 },
    ),
    listFromMongo<ServiceTicket>(
      collections.tickets,
      { customerId: id },
      { createdAt: -1 },
    ),
    listFromMongo<CareTask>(
      collections.careTasks,
      { customerId: id },
      { dueAt: -1 },
    ),
  ]);
  const visible = customer as unknown as Customer | null;
  if (visible && user && user.role !== "admin" && visible.owner !== user.name)
    return {
      customer: null,
      activities: [],
      orders: [],
      tickets: [],
      tasks: [],
    };
  return {
    customer: visible,
    activities: customerActivities,
    orders: customerOrders,
    tickets: customerTickets,
    tasks: customerTasks,
  };
}

export async function listCareTasks(
  user?: SessionUser | null,
): Promise<CareTask[]> {
  const filter = user && user.role !== "admin" ? { owner: user.name } : {};
  return hasDatabase()
    ? listFromMongo<CareTask>(collections.careTasks, filter, { dueAt: 1 })
    : tasks.filter(
        (x) => !user || user.role === "admin" || x.owner === user.name,
      );
}
export async function listTickets(
  user?: SessionUser | null,
): Promise<ServiceTicket[]> {
  const filter = user && user.role !== "admin" ? { owner: user.name } : {};
  return hasDatabase()
    ? listFromMongo<ServiceTicket>(collections.tickets, filter, {
        createdAt: -1,
      })
    : tickets.filter(
        (x) => !user || user.role === "admin" || x.owner === user.name,
      );
}
export async function getReportData(user?: SessionUser | null) {
  if (!hasDatabase()) return { customers, tasks, activities, orders, tickets };
  const [customerData, taskData, activityData, orderData, ticketData] =
    await Promise.all([
      listFromMongo<Customer>(collections.customers),
      listFromMongo<CareTask>(collections.careTasks),
      listFromMongo<CareActivity>(collections.careActivities),
      listFromMongo<SalesOrder>(collections.orders),
      listFromMongo<ServiceTicket>(collections.tickets),
    ]);
  if (!user || user.role === "admin")
    return {
      customers: customerData,
      tasks: taskData,
      activities: activityData,
      orders: orderData,
      tickets: ticketData,
    };
  const customerIds = new Set(
    customerData.filter((x) => x.owner === user.name).map((x) => x.id),
  );
  return {
    customers: customerData.filter((x) => customerIds.has(x.id)),
    tasks: taskData.filter((x) => x.owner === user.name),
    activities: activityData.filter(
      (x) => x.employee === user.name || customerIds.has(x.customerId),
    ),
    orders: orderData.filter(
      (x) => x.owner === user.name || x.salesperson === user.name,
    ),
    tickets: ticketData.filter((x) => x.owner === user.name),
  };
}

export async function getDashboardData(user?: SessionUser | null) {
  if (!hasDatabase()) {
    const report = await getReportData(user);
    return {
      ...report,
      doneCount: report.tasks.filter((item) => item.status === "done").length,
    };
  }
  const db = await getDatabase();
  const month = new Date().toISOString().slice(0, 7);
  const ownerFilter = user && user.role !== "admin" ? { owner: user.name } : {};
  const activityFilter =
    user && user.role !== "admin"
      ? { occurredAt: { $regex: `^${month}` }, employee: user.name }
      : { occurredAt: { $regex: `^${month}` } };
  const orderFilter =
    user && user.role !== "admin"
      ? { orderDate: { $regex: `^${month}` }, $or: [{ owner: user.name }, { salesperson: user.name }] }
      : { orderDate: { $regex: `^${month}` } };
  const [customerData, taskData, doneCount, activityData, orderData] =
    await Promise.all([
      db.collection(collections.customers).find(ownerFilter, {
        projection: { _id: 0, id: 1, status: 1, owner: 1 },
      }).toArray(),
      db.collection(collections.careTasks).find(
        { ...ownerFilter, status: { $ne: "done" } },
        {
          projection: {
            _id: 0,
            id: 1,
            customer: 1,
            phone: 1,
            purpose: 1,
            channel: 1,
            dueAt: 1,
            status: 1,
          },
        },
      ).sort({ dueAt: 1 }).limit(100).toArray(),
      db.collection(collections.careTasks).countDocuments({ ...ownerFilter, status: "done" }),
      db.collection(collections.careActivities).find(activityFilter, {
        projection: { _id: 0, occurredAt: 1, contactStatus: 1, result: 1, adverseReaction: 1 },
      }).toArray(),
      db.collection(collections.orders).find(orderFilter, {
        projection: { _id: 0, orderDate: 1, status: 1, total: 1, purchaseType: 1 },
      }).toArray(),
    ]);
  return {
    customers: customerData as unknown as Customer[],
    tasks: taskData as unknown as CareTask[],
    activities: activityData as unknown as CareActivity[],
    orders: orderData as unknown as SalesOrder[],
    tickets: [] as ServiceTicket[],
    doneCount,
  };
}

function isoDate(value?: string) {
  if (!value || value === "—") return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export async function reconcileCustomers() {
  if (!hasDatabase()) return { updated: 0 };
  const db = await getDatabase();
  const [customerRows, orderRows, activityRows, taskRows] = await Promise.all([
    listFromMongo<Customer>(collections.customers),
    listFromMongo<SalesOrder>(collections.orders),
    listFromMongo<CareActivity>(collections.careActivities),
    listFromMongo<CareTask>(collections.careTasks),
  ]);
  const now = new Date().toISOString();
  const operations = customerRows.map((customer) => {
    const purchased = orderRows
      .filter(
        (order) =>
          order.customerId === customer.id && order.status === "Mua hàng",
      )
      .sort((a, b) => isoDate(b.orderDate).localeCompare(isoDate(a.orderDate)));
    const customerActivities = activityRows
      .filter((activity) => activity.customerId === customer.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const pendingTasks = taskRows
      .filter(
        (task) => task.customerId === customer.id && task.status !== "done",
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const lastCare =
      customerActivities[0]?.occurredAt || customer.lastCare || "";
    let nextCare = pendingTasks[0]?.dueAt || "";
    if (!nextCare && lastCare) {
      const next = new Date(lastCare);
      next.setDate(next.getDate() + 30);
      nextCare = next.toISOString();
    }
    const status = nextCare ? (nextCare < now ? "overdue" : "due") : "done";
    const segment =
      status === "overdue"
        ? "Cần kéo lại"
        : purchased.length >= 2
          ? "Khách trung thành"
          : purchased.length === 1
            ? "Đang theo liệu trình"
            : "Khách mới";
    return {
      updateOne: {
        filter: { id: customer.id },
        update: {
          $set: {
            orders: purchased.length,
            revenue: purchased.reduce(
              (sum, order) => sum + Number(order.total || 0),
              0,
            ),
            lastOrder: purchased[0] ? isoDate(purchased[0].orderDate) : "",
            lastCare,
            nextCare,
            status,
            segment,
            reconciledAt: now,
          },
        },
      },
    };
  });
  if (operations.length)
    await db.collection(collections.customers).bulkWrite(operations);
  return { updated: operations.length };
}
