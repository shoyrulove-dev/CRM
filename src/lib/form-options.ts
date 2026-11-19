import "server-only";
import { collections } from "./data-store";
import { getDatabase, hasDatabase } from "./mongodb";
import { canSeeAll, type SessionUser } from "./session";
import { customers, orders } from "./demo-data";

export async function getFormCustomers(user: SessionUser) {
  if (!hasDatabase()) return customers.filter(item => canSeeAll(user) || item.owner === user.name)
    .map(({ id, name, phone, owner }) => ({ id, name, phone, owner }));
  return (await getDatabase()).collection(collections.customers).find(canSeeAll(user) ? {} : { owner: user.name },
    { projection: { _id: 0, id: 1, name: 1, phone: 1, owner: 1 } }).sort({ name: 1, id: 1 }).toArray();
}
export async function getFormCustomerOrders(user: SessionUser, customerId: string) {
  if (!hasDatabase()) {
    if (!customers.some(item => item.id === customerId && (canSeeAll(user) || item.owner === user.name))) return null;
    return orders.filter(item => item.customerId === customerId).map(({ id, code, customerId, orderDate, products }) => ({ id, code, customerId, orderDate, products }));
  }
  const db = await getDatabase();
  const customer = await db.collection(collections.customers).findOne({ id: customerId, ...(canSeeAll(user) ? {} : { owner: user.name }) }, { projection: { _id: 0, id: 1 } });
  if (!customer) return null;
  return db.collection(collections.orders).find({ customerId }, { projection: { _id: 0, id: 1, code: 1, customerId: 1, orderDate: 1, products: 1 } }).sort({ orderDate: -1, id: -1 }).toArray();
}
