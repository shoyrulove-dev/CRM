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
import { monthStart, monthEnd, monthBounds, dayBounds } from "./month-range";
import { escapeSearch } from "./query-utils";

function customerPhoneSearch(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.replace(/^(?:84|0)(?=\d{9}$)/, "");
  const pattern = /^[+\d\s().-]+$/.test(value) && local.length >= 3
    ? local.split("").join("\\D*") : escapeSearch(value);
  return ["phone", "contactPhone", "haravanShippingPhones"].map(field => ({ [field]: { $regex: pattern, $options: "i" } }));
}

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
].map((name, index) => ({
  // Verified against this shop's read-only Products API on 17/11/2026.
  // Keep the agreed 26 display names while using the actual Haravan SKU.
  sku: ["HH002", "HH003", "HH004", "HH007", "HH008", "HH009", "HH010", "HH011", "HH012", "HH013", "HH014", "HH015", "HH016", "HH017", "HH018", "HH031", "HH019", "HH021", "HH022_ACT6", "HH025_ACT2", "HH023_ACT6", "HH024", "HH026", "HH027", "HH032", "HH033"][index],
  name,
}));

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
    db.collection(collections.customers).createIndex({ name: 1, id: 1 }),
    db.collection(collections.customers).createIndex({ owner: 1, name: 1, id: 1 }),
    db.collection(collections.customers).createIndex({ lastOrder: 1, id: 1 }),
    db.collection(collections.customers).createIndex({ lastOrder: -1, id: 1 }),
    db
      .collection(collections.careTasks)
      .createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.careTasks).createIndex({ status: 1, dueAt: 1 }),
    db.collection(collections.careTasks).createIndex({ dueAt: 1, id: 1 }),
    db.collection(collections.careTasks).createIndex({ owner: 1, dueAt: 1, id: 1 }),
    db.collection(collections.careTasks).createIndex({ customerId: 1, dueAt: -1, id: -1 }),
    db.collection(collections.careActivities).createIndex({ taskId: 1, occurredAt: -1 }, { sparse: true }),
    db
      .collection(collections.careTasks)
      .createIndex({ owner: 1, status: 1, dueAt: 1 }),
    db
      .collection(collections.careActivities)
      .createIndex({ customerId: 1, occurredAt: -1 }),
    db.collection(collections.tickets).createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.tickets).createIndex({ owner: 1, createdAt: -1 }),
    db.collection(collections.tickets).createIndex({ createdAt: -1, id: -1 }),
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
  // The approved catalog is independent of historical order-line aliases and gifts.
  // Do not scan every order just to populate a 26-item selector.
  return requiredProducts.map(item => ({ ...item })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
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
        { name: { $regex: escapeSearch(search), $options: "i" } },
        ...customerPhoneSearch(search),
        { id: { $regex: escapeSearch(search), $options: "i" } },
      ],
    });
  if (user && !["admin", "super_admin"].includes(user.role)) clauses.push({ owner: user.name });
  const filter = clauses.length ? { $and: clauses } : {};
  return listFromMongo<Customer>(collections.customers, filter, { name: 1 });
}

export async function completedCareCustomerIds() {
  const db = hasDatabase() ? await getDatabase() : null;
  const [finished, pending] = db
    ? await Promise.all([
        db.collection(collections.careTasks).distinct<string>("customerId", { status: "done" }),
        db.collection(collections.careTasks).distinct<string>("customerId", { status: { $ne: "done" } }),
      ])
    : [tasks.filter(task => task.status === "done").map(task => task.customerId),
       tasks.filter(task => task.status !== "done").map(task => task.customerId)];
  const open = new Set(pending);
  return new Set(finished.filter(id => id && !open.has(id)));
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
    sort?: string;
  },
  user?: SessionUser | null,
) {
  const requestedPage = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page!)) : 1,
    size = Math.min(100, Math.max(1, input.size || 20));
  const completed = await completedCareCustomerIds();
  const matchesStatus = (item: Customer, status: string) =>
    status === "done" ? completed.has(item.id) : !completed.has(item.id) && item.status === status;
  if (!hasDatabase()) {
    const filtered = customers.filter(
      (item) =>
        (!user || ["admin", "super_admin"].includes(user.role) || item.owner === user.name) &&
        (!input.search ||
          `${item.name} ${item.phone} ${item.id}`
            .toLowerCase()
            .includes(input.search.toLowerCase())) &&
        (!input.owner || item.owner === input.owner) &&
        (!input.from || item.lastOrder >= input.from) &&
        (!input.to || item.lastOrder <= input.to),
    );
    const counts = { allCount: filtered.length, dueCount: filtered.filter(item => matchesStatus(item, "due")).length, overdueCount: filtered.filter(item => matchesStatus(item, "overdue")).length, doneCount: filtered.filter(item => completed.has(item.id)).length };
    const selected = filtered.filter(item => !input.status || matchesStatus(item, input.status));
    selected.sort((a, b) => input.sort === "newest" ? b.lastOrder.localeCompare(a.lastOrder) : input.sort === "oldest" ? a.lastOrder.localeCompare(b.lastOrder) : a.name.localeCompare(b.name, "vi"));
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(selected.length / size)));
    return {
      page,
      items: selected.slice((page - 1) * size, page * size).map(item => ({ ...item, careCompleted: completed.has(item.id) })),
      ...counts,
      total: selected.length,
      totalRevenue: selected.reduce((sum, item) => sum + item.revenue, 0),
      totalOrders: selected.reduce((sum, item) => sum + item.orders, 0),
    };
  }
  const filter: Record<string, unknown> = {};
  if (user && !["admin", "super_admin"].includes(user.role)) filter.owner = user.name;
  else if (input.owner) filter.owner = input.owner;
  if (input.from || input.to)
    filter.lastOrder = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  if (input.search)
    filter.$or = [
      { name: { $regex: escapeSearch(input.search), $options: "i" } },
      ...customerPhoneSearch(input.search),
      { id: { $regex: escapeSearch(input.search), $options: "i" } },
    ];
  const db = await getDatabase();
  const countFilter = { ...filter };
  const completedIds = [...completed];
  if (input.status === "done") filter.id = { $in: completedIds };
  else if (input.status) Object.assign(filter, { status: input.status, id: { $nin: completedIds } });
  const [totals, counts] = await Promise.all([
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
            dueCount: { $sum: { $cond: [{ $eq: ["$status", "due"] }, 1, 0] } },
            overdueCount: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } },
          },
        },
      ])
      .next(),
    db.collection(collections.customers).aggregate([
      { $match: countFilter },
      { $set: { completed: { $in: ["$id", completedIds] } } },
      { $group: {
        _id: null, allCount: { $sum: 1 },
        dueCount: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "due"] }, { $not: ["$completed"] }] }, 1, 0] } },
        overdueCount: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "overdue"] }, { $not: ["$completed"] }] }, 1, 0] } },
        doneCount: { $sum: { $cond: ["$completed", 1, 0] } },
      } },
    ]).next(),
  ]);
  const total = Number(totals?.total || 0);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / size)));
  const items = await db.collection(collections.customers)
    .find(filter, { projection: { _id: 0 } })
    .sort(input.sort === "newest" ? { lastOrder: -1, id: 1 } : input.sort === "oldest" ? { lastOrder: 1, id: 1 } : { name: 1, id: 1 })
    .skip((page - 1) * size)
    .limit(size)
    .toArray();
  return {
    page,
    items: (items as unknown as Customer[]).map(item => ({ ...item, careCompleted: completed.has(item.id) })),
    total,
    totalRevenue: Number(totals?.totalRevenue || 0),
    totalOrders: Number(totals?.totalOrders || 0),
    allCount: Number(counts?.allCount ?? 0),
    dueCount: Number(counts?.dueCount ?? 0),
    overdueCount: Number(counts?.overdueCount ?? 0),
    doneCount: Number(counts?.doneCount ?? 0),
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

export async function getCareTaskActivities(taskIds: string[], user: SessionUser) {
  if (!hasDatabase() || !taskIds.length) return [];
  return (await getDatabase()).collection(collections.careActivities).find({
    taskId: { $in: taskIds },
    ...(["admin", "super_admin"].includes(user.role) ? {} : { employee: user.name }),
  }, { projection: { _id: 0, id: 1, taskId: 1, note: 1, result: 1, occurredAt: 1 } }).sort({ occurredAt: -1 }).toArray();
}

export async function getCarePageData(params: { date?: string; from?: string; to?: string; owner?: string; status?: string; task?: string; page?: string }, user: SessionUser | null) {
  const size = 20;
  const requestedPage = Math.max(1, Math.min(1000000, Math.floor(Number(params.page) || 1)));
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const todayBounds = dayBounds(today)!;
  const base = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {};
  const selectedDay = dayBounds(params.date);
  const scope = { ...base, ...(!("owner" in base) && params.owner ? { owner: params.owner } : {}),
    ...(params.task ? { id: params.task } : {}),
    ...(selectedDay ? { dueAt: selectedDay } :
      monthStart(params.from) || monthEnd(params.to) ? { dueAt: monthBounds(params.from, params.to) } : {}) };
  const filter = { ...scope, ...(params.status ? { status: params.status } : {}) };
  const summarize = (rows: { count: number; customerId?: string }[]) => ({
    count: rows.reduce((total, row) => total + row.count, 0),
    customers: new Set(rows.map(row => row.customerId).filter(Boolean)).size,
  });
  if (!hasDatabase()) {
    const all = await listCareTasks(user);
    const bounds = scope.dueAt;
    const scoped = all.filter(task => (!scope.owner || task.owner === scope.owner) && (!scope.id || task.id === scope.id) &&
      (!bounds?.$gte || task.dueAt >= bounds.$gte) && (!bounds?.$lte || task.dueAt <= bounds.$lte));
    const selected = scoped.filter(task => !params.status || task.status === params.status);
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(selected.length / size)));
    const stats = (predicate: (task: CareTask) => boolean) =>
      summarize(scoped.filter(predicate).map(task => ({ count: 1, customerId: task.customerId })));
    return { tasks: selected.slice((page - 1) * size, page * size), page, size, total: selected.length,
      overdue: stats(task => task.status === "overdue"), done: stats(task => task.status === "done"),
      today: stats(task => task.status !== "done" && task.dueAt >= todayBounds.$gte && task.dueAt <= todayBounds.$lte) };
  }
  const col = (await getDatabase()).collection(collections.careTasks);
  const stats = async (condition: Record<string, unknown>) => summarize(
    await col.aggregate<{ count: number; customerId?: string }>([
      { $match: { $and: [scope, condition] } },
      { $group: { _id: "$customerId", count: { $sum: 1 } } },
      { $project: { _id: 0, customerId: "$_id", count: 1 } },
    ]).toArray(),
  );
  const [total, overdue, done, dueToday] = await Promise.all([
    col.countDocuments(filter),
    stats({ status: "overdue" }), stats({ status: "done" }),
    stats({ status: { $ne: "done" }, dueAt: todayBounds }),
  ]);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / size)));
  const rows = await col.find(filter, { projection: { _id: 0 } }).sort({ dueAt: 1, id: 1 }).skip((page - 1) * size).limit(size).toArray();
  return { tasks: rows as unknown as CareTask[], page, size, total, overdue, done, today: dueToday };
}

export async function getTicketsPage(params: { q?: string; status?: string; owner?: string; resolution?: string; from?: string; to?: string; date?: string; page?: string }, user: SessionUser | null) {
  const size = 20, requested = Math.max(1, Math.min(1000000, Math.floor(Number(params.page) || 1)));
  const scope = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : params.owner ? { owner: params.owner } : {};
  const selectedBounds = dayBounds(params.date) || monthBounds(params.from, params.to);
  if (!hasDatabase()) {
    const needle = (params.q || "").toLocaleLowerCase("vi");
    const bounds = selectedBounds;
    const selected = (await listTickets(user)).filter((item) => (!params.owner || item.owner === params.owner) && (!params.status || item.status === params.status) && (!params.resolution || item.resolution === params.resolution) && (!bounds.$gte || item.createdAt >= bounds.$gte) && (!bounds.$lte || item.createdAt <= bounds.$lte) && (!needle || `${item.id} ${item.customer} ${item.title} ${customers.find((c) => c.id === item.customerId)?.phone || ""}`.toLocaleLowerCase("vi").includes(needle)));
    const page = Math.min(requested, Math.max(1, Math.ceil(selected.length / size)));
    return { items: selected.slice((page - 1) * size, page * size), total: selected.length, page, size };
  }
  const db = await getDatabase();
  const filter: Record<string, unknown> = { ...scope, ...(params.status ? { status: params.status } : {}), ...(params.resolution ? { resolution: params.resolution } : {}), ...(Object.keys(selectedBounds).length ? { createdAt: selectedBounds } : {}) };
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
export async function getReportData(user?: SessionUser | null, options: {
  summary?: boolean; purchaseReport?: boolean; includeOrderCodes?: boolean; sections?: Array<"customers" | "tasks" | "activities" | "orders" | "tickets">;
} = {}) {
  const restricted = !!user && !["admin", "super_admin"].includes(user.role);
  const sections = new Set(options.sections || ["customers", "tasks", "activities", "orders", "tickets"]);
  if (!hasDatabase()) {
    const customerData = customers.filter(item => !restricted || item.owner === user!.name);
    const ids = new Set(customerData.map(item => item.id));
    return {
      customers: sections.has("customers") ? customerData : [],
      tasks: sections.has("tasks") ? tasks.filter(item => !restricted || item.owner === user!.name) : [],
      activities: sections.has("activities") ? activities.filter(item => !restricted || item.employee === user!.name || ids.has(item.customerId)) : [],
      orders: sections.has("orders") ? orders.filter(item => !restricted || item.owner === user!.name || item.salesperson === user!.name ||
        item.reportAdjustment?.owner === user!.name || item.reportAdjustment?.shares?.some(share => share.employee === user!.name)) : [],
      tickets: sections.has("tickets") ? tickets.filter(item => !restricted || item.owner === user!.name) : [],
    };
  }
  const db = await getDatabase();
  const owner = restricted ? { owner: user!.name } : {};
  const customerData = sections.has("customers") || (restricted && sections.has("activities"))
    ? await db.collection(collections.customers).find(owner, { projection: options.summary
      ? { _id: 0, id: 1, owner: 1 } : options.purchaseReport ? { _id: 0, id: 1, name: 1 } : { _id: 0 } }).toArray() : [];
  const read = async <T>(name: string, enabled: boolean, filter: Record<string, unknown>, projection: Record<string, number>) =>
    enabled ? await db.collection(name).find(filter, { projection: options.summary || options.purchaseReport ? projection : { _id: 0 } }).toArray() as unknown as T[] : [] as T[];
  const [taskData, activityData, orderData, ticketData] = await Promise.all([
    read<CareTask>(collections.careTasks, sections.has("tasks"), owner, { _id: 0, owner: 1, dueAt: 1, status: 1, customerId: 1 }),
    read<CareActivity>(collections.careActivities, sections.has("activities"), restricted ? {
      $or: [{ employee: user!.name }, { customerId: { $in: customerData.map(item => item.id) } }],
    } : {}, { _id: 0, customerId: 1, occurredAt: 1, employee: 1, channel: 1, purpose: 1,
      contactStatus: 1, result: 1, productEndDate: 1, repurchaseTimely: 1, satisfaction: 1, adverseReaction: 1, noPurchaseReason: 1 }),
    read<SalesOrder>(collections.orders, sections.has("orders"), restricted ? {
      $or: [{ owner: user!.name }, { salesperson: user!.name }, { "reportAdjustment.owner": user!.name }, { "reportAdjustment.shares.employee": user!.name }],
    } : {}, { _id: 0, customerId: 1, orderDate: 1, owner: 1, salesperson: 1, channel: 1, status: 1, total: 1, shippingFee: 1, deliveryState: 1, purchaseType: 1, reportAdjustment: 1,
      ...(options.includeOrderCodes ? { id: 1, code: 1, haravanId: 1 } : {}),
      ...(options.purchaseReport ? { id: 1, code: 1, "products.sku": 1, "products.name": 1 } : {}) }),
    read<ServiceTicket>(collections.tickets, sections.has("tickets"), owner, { _id: 0, id: 1, owner: 1, status: 1, createdAt: 1 }),
  ]);
  return { customers: sections.has("customers") ? customerData as unknown as Customer[] : [], tasks: taskData, activities: activityData, orders: orderData, tickets: ticketData };
}

export async function getDashboardData(user?: SessionUser | null) {
  if (!hasDatabase()) {
    const report = await getReportData(user);
    return {
      ...report,
      doneCount: report.tasks.filter((item) => item.status === "done").length,
      openCount: report.tasks.filter((item) => item.status !== "done").length,
      overdueCount: report.tasks.filter((item) => item.status === "overdue").length,
      todayCount: report.tasks.filter((item) => item.status !== "done" && (item.dueAt.startsWith(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())) || item.dueAt.startsWith("Hôm nay"))).length,
    };
  }
  const db = await getDatabase();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const month = today.slice(0, 7);
  const ownerFilter = user && !["admin", "super_admin"].includes(user.role) ? { owner: user.name } : {};
  const activityFilter =
    user && !["admin", "super_admin"].includes(user.role)
      ? { occurredAt: { $regex: `^${month}` }, employee: user.name }
      : { occurredAt: { $regex: `^${month}` } };
  const orderFilter =
    user && !["admin", "super_admin"].includes(user.role)
      ? { orderDate: { $regex: `^${month}` }, $or: [{ owner: user.name }, { salesperson: user.name }] }
      : { orderDate: { $regex: `^${month}` } };
  const [customerData, taskData, doneCount, activityData, orderData, openCount, overdueCount, todayCount] =
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
      ).sort({ dueAt: 1 }).limit(7).toArray(),
      db.collection(collections.careTasks).countDocuments({ ...ownerFilter, status: "done" }),
      db.collection(collections.careActivities).find(activityFilter, {
        projection: { _id: 0, occurredAt: 1, contactStatus: 1, result: 1, adverseReaction: 1 },
      }).toArray(),
      db.collection(collections.orders).find(orderFilter, {
        projection: { _id: 0, orderDate: 1, status: 1, total: 1, purchaseType: 1 },
      }).toArray(),
      db.collection(collections.careTasks).countDocuments({ ...ownerFilter, status: { $ne: "done" } }),
      db.collection(collections.careTasks).countDocuments({ ...ownerFilter, status: "overdue" }),
      db.collection(collections.careTasks).countDocuments({ ...ownerFilter, status: { $ne: "done" }, dueAt: { $gte: new Date(`${today}T00:00:00+07:00`).toISOString(), $lte: new Date(`${today}T23:59:59+07:00`).toISOString() } }),
    ]);
  return {
    customers: customerData as unknown as Customer[],
    tasks: taskData as unknown as CareTask[],
    activities: activityData as unknown as CareActivity[],
    orders: orderData as unknown as SalesOrder[],
    tickets: [] as ServiceTicket[],
    doneCount,
    openCount, overdueCount, todayCount,
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
    // Historic Excel entries must not silently create/reschedule current care work.
    listFromMongo<CareActivity>(collections.careActivities, { source: { $ne: "excel-import" } }),
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
    const lastCare = [customerActivities[0]?.occurredAt, customer.lastCare]
      .filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "";
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
