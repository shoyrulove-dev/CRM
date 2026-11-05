import { activities, customers, orders, tasks, tickets } from "./demo-data";
import { getDatabase, hasDatabase } from "./mongodb";
import type { CareActivity, CareTask, Customer, SalesOrder, ServiceTicket } from "./types";

export const collections = {
  customers: "customers",
  careTasks: "care_tasks",
  careActivities: "care_activities",
  tickets: "service_tickets",
  orders: "orders",
  syncEvents: "sync_events",
  auditLogs: "audit_logs",
} as const;

export async function ensureIndexes() {
  if (!hasDatabase()) return false;
  const db = await getDatabase();
  await Promise.all([
    db.collection(collections.customers).createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.customers).createIndex({ phone: 1 }),
    db.collection(collections.careTasks).createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.careTasks).createIndex({ status: 1, dueAt: 1 }),
    db.collection(collections.careActivities).createIndex({ customerId: 1, occurredAt: -1 }),
    db.collection(collections.tickets).createIndex({ id: 1 }, { unique: true }),
    db.collection(collections.orders).createIndex({ code: 1 }, { unique: true }),
    db.collection(collections.orders).createIndex({ customerId: 1, orderDate: -1 }),
    db.collection(collections.syncEvents).createIndex({ externalId: 1, topic: 1 }, { unique: true, sparse: true }),
  ]);
  return true;
}

export async function seedDemoData() {
  if (!hasDatabase()) throw new Error("MONGODB_URI is not configured");
  const db = await getDatabase();
  await ensureIndexes();
  const batches: Array<[string, Array<Customer | CareTask | CareActivity | ServiceTicket | SalesOrder>]> = [
    [collections.customers, customers], [collections.careTasks, tasks], [collections.careActivities, activities], [collections.tickets, tickets], [collections.orders, orders],
  ];
  for (const [name, documents] of batches) {
    for (const document of documents) await db.collection(name).updateOne({ id: document.id }, { $set: document }, { upsert: true });
  }
  return Object.fromEntries(batches.map(([name, docs]) => [name, docs.length]));
}

async function listFromMongo<T>(collection: string, filter = {}, sort = {}) {
  const db = await getDatabase();
  return db.collection(collection).find(filter, { projection: { _id: 0 } }).sort(sort).toArray() as unknown as T[];
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  if (!hasDatabase()) return customers.filter(c => !search || `${c.name} ${c.phone} ${c.id}`.toLowerCase().includes(search.toLowerCase()));
  const filter = search ? { $or: [{ name: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }, { id: { $regex: search, $options: "i" } }] } : {};
  return listFromMongo<Customer>(collections.customers, filter, { name: 1 });
}

export async function getCustomerProfile(id: string) {
  if (!hasDatabase()) return { customer: customers.find(c => c.id === id) || null, activities: activities.filter(a => a.customerId === id), orders: orders.filter(o => o.customerId === id), tickets: tickets.filter(t => t.customerId === id) };
  const db = await getDatabase();
  const [customer, customerActivities, customerOrders, customerTickets] = await Promise.all([
    db.collection(collections.customers).findOne({ id }, { projection: { _id: 0 } }),
    listFromMongo<CareActivity>(collections.careActivities, { customerId: id }, { occurredAt: -1 }),
    listFromMongo<SalesOrder>(collections.orders, { customerId: id }, { orderDate: -1 }),
    listFromMongo<ServiceTicket>(collections.tickets, { customerId: id }, { createdAt: -1 }),
  ]);
  return { customer: customer as unknown as Customer | null, activities: customerActivities, orders: customerOrders, tickets: customerTickets };
}

export async function listCareTasks(): Promise<CareTask[]> { return hasDatabase() ? listFromMongo<CareTask>(collections.careTasks, {}, { dueAt: 1 }) : tasks; }
export async function listTickets(): Promise<ServiceTicket[]> { return hasDatabase() ? listFromMongo<ServiceTicket>(collections.tickets, {}, { createdAt: -1 }) : tickets; }
export async function getReportData() {
  if (!hasDatabase()) return { customers, tasks, activities, orders, tickets };
  const [customerData, taskData, activityData, orderData, ticketData] = await Promise.all([
    listFromMongo<Customer>(collections.customers), listFromMongo<CareTask>(collections.careTasks), listFromMongo<CareActivity>(collections.careActivities), listFromMongo<SalesOrder>(collections.orders), listFromMongo<ServiceTicket>(collections.tickets),
  ]);
  return { customers: customerData, tasks: taskData, activities: activityData, orders: orderData, tickets: ticketData };
}
