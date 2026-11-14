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

const requiredProducts: ProductOption[] = [
  "Mozuku seaweed extract processed food, EX Fucoidan", "BH Collagen Rich",
  "DHA.EPA+SQ", "Intestines Beauty Queen", "Nano Liver Hydrolyzate EX",
  "NANO OYSTER GOLD", "NANO Premium SHARK CARTILAGE", "NANO GROWTH HABIT EX",
  "OKINAWA FUCOIDAN", "PREMIUM HIGH GUARD", "NANO NMN + ALL IN ONE GEL",
  "NANO NMN + FOAMING SOAP", "NANO NMN + PEELING GEL", "NANO NMN + 3D FACE MASK",
  "NANO NMN + UV ESSENCE", "NANO NMN + UV ESSENCE LUXURY", "Liver Hydrolyzate Plus",
  "NANO FUCOIDAN KENGEN", "NICHIEI NMN+27000 (black package)",
  "NICHIEI NMN+27000 (white package)", "GLUCHON GEL",
  "DILI Okinawa Osake Wo Kaiteki No Densetu", "Okinawa Fucoidan Plus",
  "NANO NATTOKINASE PREMIUM 120 viên", "NANO NATTOKINASE PREMIUM 60 viên",
  "ANSERINE PREMIUM",
].map((name, index) => ({ sku: `NIC-${String(index + 1).padStart(3, "0")}`, name }));

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
  const mergeRequired = (items: ProductOption[]) => {
    const map = new Map(requiredProducts.map((item) => [item.name.toLocaleLowerCase("vi"), item]));
    items.forEach((item) => map.set(item.name.toLocaleLowerCase("vi"), item));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  };
  if (!hasDatabase()) {
    const map = new Map<string, ProductOption>();
    orders.flatMap((order) => order.products).forEach((product) => {
      if (product.sku) map.set(product.sku, { sku: product.sku, name: product.name });
    });
    return mergeRequired([...map.values()]);
  }
  const rows = await (await getDatabase()).collection(collections.orders).aggregate([
    { $unwind: "$products" },
    { $match: { "products.sku": { $type: "string", $ne: "" } } },
    { $sort: { orderDate: -1 } },
    { $group: { _id: "$products.sku", name: { $first: "$products.name" } } },
    { $project: { _id: 0, sku: "$_id", name: 1 } },
    { $sort: { name: 1 } },
  ]).toArray();
  return mergeRequired(rows as ProductOption[]);
}

export async function listCustomers(
  search?: string,
  user?: SessionUser | null,
): Promise<Customer[]> {
  if (!hasDatabase())
    return customers.filter(
      (c) =>
        (!user || ["admin", "super_admin"].includes(user.role) || c.owner === user.name) &&
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
  if (user && !["admin", "super_admin"].includes(user.role)) clauses.push({ owner: user.name });
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
        (!user || ["admin", "super_admin"].includes(user.role) || item.owner === user.name) &&
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
  if (user && !["admin", "super_admin"].includes(user.role)) filter.owner = user.name;
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

export async function listCustomerContacts(ids: string[], user: SessionUser | null) {
  if (!ids.length) return [];
  if (!hasDatabase()) return customers.filter((c) => ids.includes(c.id) && (!user || ["admin", "super_admin"].includes(user.role) || c.owner === user.name)).map(({ id, phone }) => ({ id, phone }));
  const db = await getDatabase();
  return await db.collection(collections.customers).find({ id: { $in: ids }, ...(user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {}) }, { projection: { _id: 0, id: 1, phone: 1 } }).toArray() as unknown as { id: string; phone: string }[];
}

export async function getCustomerProfile(
  id: string,
  user?: SessionUser | null,
  history?: { tab: "orders" | "reminders" | "care" | "tickets"; page: number; size: number },
) {
  if (history && hasDatabase()) {
    const db = await getDatabase();
    const customer = await db.collection(collections.customers).findOne({ id, ...(user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {}) }, { projection: { _id: 0 } }) as unknown as Customer | null;
    const empty = { customer: null, activities: [] as CareActivity[], orders: [] as SalesOrder[], tickets: [] as ServiceTicket[], tasks: [] as CareTask[], counts: { orders: 0, reminders: 0, care: 0, tickets: 0 }, page: 1 };
    if (!customer) return empty;
    const names = { orders: collections.orders, reminders: collections.careTasks, care: collections.careActivities, tickets: collections.tickets };
    const countsArray = await Promise.all(Object.values(names).map((name) => db.collection(name).countDocuments({ customerId: id })));
    const counts = { orders: countsArray[0], reminders: countsArray[1], care: countsArray[2], tickets: countsArray[3] };
    const page = Math.min(history.page, Math.max(1, Math.ceil(counts[history.tab] / history.size)));
    const field = history.tab === "orders" ? "orderDate" : history.tab === "reminders" ? "dueAt" : history.tab === "care" ? "occurredAt" : "createdAt";
    const rows = await db.collection(names[history.tab]).find({ customerId: id }, { projection: { _id: 0 } }).sort({ [field]: -1, id: -1 }).skip((page - 1) * history.size).limit(history.size).toArray();
    // Only the active history tab is rendered. Order selectors keep this
    // customer's orders available for creating activities, tickets and care.
    const orderOptions = await db.collection(collections.orders).find({ customerId: id }, { projection: { _id: 0 } }).sort({ orderDate: -1 }).toArray();
    return { customer, counts, page, orderOptions: orderOptions as unknown as SalesOrder[], orders: (history.tab === "orders" ? rows : []) as unknown as SalesOrder[], activities: (history.tab === "care" ? rows : []) as unknown as CareActivity[], tasks: (history.tab === "reminders" ? rows : []) as unknown as CareTask[], tickets: (history.tab === "tickets" ? rows : []) as unknown as ServiceTicket[] };
  }
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
  if (visible && user && !["admin", "super_admin"].includes(user.role) && visible.owner !== user.name)
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

export async function getCarePageData(params: { date?: string; from?: string; to?: string; owner?: string; status?: string; task?: string; page?: string }, user: SessionUser | null) {
  const size = 20;
  const requestedPage = Math.max(1, Math.min(1000000, Math.floor(Number(params.page) || 1)));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const base = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {};
  const filter = { ...base, ...(!("owner" in base) && params.owner ? { owner: params.owner } : {}),
    ...(params.status ? { status: params.status } : {}), ...(params.task ? { id: params.task } : {}),
    ...(params.date ? { dueAt: { $gte: new Date(`${params.date}T00:00:00+07:00`).toISOString(), $lte: new Date(`${params.date}T23:59:59+07:00`).toISOString() } } :
      params.from || params.to ? { dueAt: { ...(params.from ? { $gte: `${params.from}-01` } : {}), ...(params.to ? { $lte: `${params.to}-31T23:59:59.999Z` } : {}) } } : {}) };
  if (!hasDatabase()) {
    const all = await listCareTasks(user);
    const selected = all.filter((task) => (!params.owner || task.owner === params.owner) && (!params.status || task.status === params.status) && (!params.task || task.id === params.task) && (!params.date || task.dueAt.startsWith(params.date)) && (!params.from || task.dueAt >= `${params.from}-01`) && (!params.to || task.dueAt <= `${params.to}-31T23:59:59.999Z`));
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(selected.length / size)));
    return { tasks: selected.slice((page - 1) * size, page * size), page, size, total: selected.length, overdue: all.filter((task) => task.status === "overdue").length, done: all.filter((task) => task.status === "done").length, today: all.filter((task) => task.status !== "done" && task.dueAt.startsWith(today)).length };
  }
  const col = (await getDatabase()).collection(collections.careTasks);
  const [total, overdue, done, dueToday] = await Promise.all([
    col.countDocuments(filter),
    col.countDocuments({ ...base, status: "overdue" }), col.countDocuments({ ...base, status: "done" }),
    col.countDocuments({ ...base, status: { $ne: "done" }, dueAt: { $gte: new Date(`${today}T00:00:00+07:00`).toISOString(), $lte: new Date(`${today}T23:59:59+07:00`).toISOString() } }),
  ]);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / size)));
  const rows = await col.find(filter, { projection: { _id: 0 } }).sort({ dueAt: 1, id: 1 }).skip((page - 1) * size).limit(size).toArray();
  return { tasks: rows as unknown as CareTask[], page, size, total, overdue, done, today: dueToday };
}

export async function getTicketsPage(params: { q?: string; status?: string; owner?: string; resolution?: string; from?: string; to?: string; page?: string }, user: SessionUser | null) {
  const size = 20, requested = Math.max(1, Math.min(1000000, Math.floor(Number(params.page) || 1)));
  const scope = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : params.owner ? { owner: params.owner } : {};
  if (!hasDatabase()) {
    const needle = (params.q || "").toLocaleLowerCase("vi");
    const selected = (await listTickets(user)).filter((item) => (!params.owner || item.owner === params.owner) && (!params.status || item.status === params.status) && (!params.resolution || item.resolution === params.resolution) && (!params.from || item.createdAt >= `${params.from}-01`) && (!params.to || item.createdAt <= `${params.to}-31T23:59:59Z`) && (!needle || `${item.id} ${item.customer} ${item.title} ${customers.find((c) => c.id === item.customerId)?.phone || ""}`.toLocaleLowerCase("vi").includes(needle)));
    const page = Math.min(requested, Math.max(1, Math.ceil(selected.length / size)));
    return { items: selected.slice((page - 1) * size, page * size), total: selected.length, page, size };
  }
  const db = await getDatabase();
  const filter: Record<string, unknown> = { ...scope, ...(params.status ? { status: params.status } : {}), ...(params.resolution ? { resolution: params.resolution } : {}), ...(params.from || params.to ? { createdAt: { ...(params.from ? { $gte: `${params.from}-01` } : {}), ...(params.to ? { $lte: `${params.to}-31T23:59:59Z` } : {}) } } : {}) };
  if (params.q?.trim()) {
    const pattern = params.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const customerIds = await db.collection(collections.customers).distinct("id", { ...(user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {}), phone: { $regex: pattern, $options: "i" } });
    filter.$or = [...["id", "customer", "title"].map((field) => ({ [field]: { $regex: pattern, $options: "i" } })), { customerId: { $in: customerIds } }];
  }
  const col = db.collection(collections.tickets), total = await col.countDocuments(filter);
  const page = Math.min(requested, Math.max(1, Math.ceil(total / size)));
  const items = await col.find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1, id: -1 }).skip((page - 1) * size).limit(size).toArray();
  return { items: items as unknown as ServiceTicket[], total, page, size };
}

export async function listCareTasks(
  user?: SessionUser | null,
): Promise<CareTask[]> {
  const filter = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {};
  return hasDatabase()
    ? listFromMongo<CareTask>(collections.careTasks, filter, { dueAt: 1 })
    : tasks.filter(
        (x) => !user || ["admin", "super_admin"].includes(user.role) || x.owner === user.name,
      );
}
export async function listTickets(
  user?: SessionUser | null,
): Promise<ServiceTicket[]> {
  const filter = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {};
  return hasDatabase()
    ? listFromMongo<ServiceTicket>(collections.tickets, filter, {
        createdAt: -1,
      })
    : tickets.filter(
        (x) => !user || ["admin", "super_admin"].includes(user.role) || x.owner === user.name,
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
  if (!user || ["admin", "super_admin"].includes(user.role))
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
  const ownerFilter = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {};
  const activityFilter =
    user && !["admin", "super_admin"].includes(user.role)
      ? { occurredAt: { $regex: `^${month}` }, employee: user.name }
      : { occurredAt: { $regex: `^${month}` } };
  const orderFilter =
    user && !["admin", "super_admin"].includes(user.role)
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
  function groupByCustomer<T extends { customerId?: string }>(rows: T[]) {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.customerId) continue;
      const list = grouped.get(row.customerId);
      if (list) list.push(row); else grouped.set(row.customerId, [row]);
    }
    return grouped;
  }
  const ordersByCustomer = groupByCustomer(orderRows.filter((order) => order.status === "Mua hàng"));
  const activitiesByCustomer = groupByCustomer(activityRows);
  const tasksByCustomer = groupByCustomer(taskRows.filter((task) => task.status !== "done"));
  const operations = customerRows.map((customer) => {
    const purchased = (ordersByCustomer.get(customer.id) || [])
      .sort((a, b) => isoDate(b.orderDate).localeCompare(isoDate(a.orderDate)));
    const customerActivities = (activitiesByCustomer.get(customer.id) || [])
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const pendingTasks = (tasksByCustomer.get(customer.id) || [])
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const lastCare =
      customerActivities[0]?.occurredAt || customer.lastCare || "";
    const upcomingTask = pendingTasks.find((task) => task.dueAt >= now);
    let nextCare = upcomingTask?.dueAt || pendingTasks.at(-1)?.dueAt || "";
    if (!nextCare && lastCare) {
      const next = new Date(lastCare);
      next.setDate(next.getDate() + 30);
      nextCare = next.toISOString();
    }
    const status = pendingTasks.some((task) => task.dueAt < now) || (nextCare && nextCare < now)
      ? "overdue"
      : nextCare ? "due" : "done";
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
            segment: customer.segment || "Chưa xác định",
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
