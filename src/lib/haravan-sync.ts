import "server-only";
import { collections, ensureIndexes, reconcileCustomers } from "./data-store";
import { getIntegrationConfig } from "./integration-config";
import { getDatabase, hasDatabase } from "./mongodb";

type HaravanCustomer = {
  id: number | string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  default_address?: { phone?: string | null } | null;
  orders_count?: number;
  total_spent?: number | string;
  last_order_date?: string | null;
  birthday?: string | null;
  tags?: string | null;
  created_at?: string;
  updated_at?: string;
};

type HaravanOrder = {
  id: number;
  name?: string;
  order_number?: number;
  created_at?: string;
  updated_at?: string;
  cancelled_at?: string | null;
  financial_status?: string | null;
  total_price?: number | string;
  total_discounts?: number | string;
  gateway?: string | null;
  source_name?: string | null;
  landing_site_ref?: string | null;
  customer?: HaravanCustomer | null;
  billing_address?: { name?: string; phone?: string } | null;
  shipping_address?: { name?: string; phone?: string } | null;
  line_items?: Array<{
    sku?: string | null;
    title?: string;
    name?: string;
    quantity?: number;
    price?: number | string;
    total_discount?: number | string;
  }>;
};

const API = "https://apis.haravan.com/com";

function phoneOf(customer?: HaravanCustomer | null) {
  return String(customer?.phone || customer?.default_address?.phone || "").trim();
}

function customerName(customer?: HaravanCustomer | null) {
  return [customer?.first_name, customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function fetchPages<T>(
  resource: "customers" | "orders",
  token: string,
  updatedAtMin?: string,
  startPage = 1,
) {
  const countUrl = new URL(`${API}/${resource}/count.json`);
  if (resource === "orders") countUrl.searchParams.set("status", "any");
  if (updatedAtMin) countUrl.searchParams.set("updated_at_min", updatedAtMin);
  const countResponse = await fetch(countUrl, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!countResponse.ok)
    throw new Error(`Haravan không thể đếm ${resource} (lỗi ${countResponse.status}).`);
  const countPayload = (await countResponse.json()) as { count?: number };
  const total = Number(countPayload.count || 0);
  const totalPages = Math.ceil(total / 50);
  // Keep each import comfortably below Vercel's function duration limit.
  const lastPage = Math.min(totalPages, startPage + 4);
  const pages = Array.from(
    { length: Math.max(0, lastPage - startPage + 1) },
    (_, index) => startPage + index,
  );
  const fetchPage = async (page: number) => {
    const url = new URL(`${API}/${resource}.json`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("page", String(page));
    url.searchParams.set("order", "updated_at asc");
    if (resource === "orders") url.searchParams.set("status", "any");
    if (updatedAtMin) url.searchParams.set("updated_at_min", updatedAtMin);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok)
      throw new Error(`Haravan không thể đọc ${resource} (lỗi ${response.status}).`);
    const payload = (await response.json()) as Record<string, T[]>;
    return payload[resource] || [];
  };
  const batches: T[][] = [];
  for (let offset = 0; offset < pages.length; offset += 5)
    batches.push(...(await Promise.all(pages.slice(offset, offset + 5).map(fetchPage))));
  const earlyEnd = batches.findIndex((batch) => batch.length < 50);
  const processedPages = earlyEnd >= 0 ? earlyEnd + 1 : pages.length;
  const done = startPage + processedPages > totalPages || earlyEnd >= 0;
  return {
    rows: batches.slice(0, processedPages).flat(),
    total,
    nextPage: startPage + processedPages,
    done,
  };
}

async function upsertCustomer(
  raw: HaravanCustomer,
  fallback?: { name?: string; phone?: string },
) {
  const db = await getDatabase();
  const haravanId = String(raw.id || "");
  const phone = phoneOf(raw) || String(fallback?.phone || "").trim();
  const phoneNormalized = phone.replace(/\D/g, "");
  const name = customerName(raw) || fallback?.name || phone || "Khách Haravan";
  const match = haravanId
    ? {
        $or: [
          { haravanId },
          ...(phone
            ? [
                { phone },
                { phoneNormalized },
                { phone: { $regex: `^${phoneNormalized.split("").join("\\D*")}$` } },
              ]
            : []),
        ],
      }
    : { phone };
  const existing = await db.collection(collections.customers).findOne(match);
  const id = String(existing?.id || `HRV-KH-${haravanId || Date.now()}`);
  await db.collection(collections.customers).updateOne(
    match,
    {
      $set: {
        haravanId: haravanId || undefined,
        name,
        phone,
        phoneNormalized,
        birthDate: raw.birthday?.slice(0, 10) || String(existing?.birthDate || ""),
        haravanTags: raw.tags || "",
        haravanUpdatedAt: raw.updated_at || "",
        source: "haravan",
        syncedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        id,
        owner: "Chưa phân công",
        segment: "Khách mới",
        orders: Number(raw.orders_count || 0),
        revenue: Number(raw.total_spent || 0),
        lastOrder: raw.last_order_date?.slice(0, 10) || "",
        nextCare: "",
        status: "due",
        healthGoal: "Chưa xác định",
        createdAt: raw.created_at || new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  return { id, owner: String(existing?.owner || "Chưa phân công") };
}

export async function syncHaravanData() {
  if (!hasDatabase()) throw new Error("Cơ sở dữ liệu chưa sẵn sàng.");
  const config = await getIntegrationConfig();
  if (!config.haravanAccessToken) throw new Error("Chưa lưu Token Haravan.");
  await ensureIndexes();
  const db = await getDatabase();
  const previous = await db
    .collection(collections.settings)
    .findOne({ id: "haravan_sync" });
  const startedAt = new Date();
  const incremental = Boolean(previous?.complete && previous?.lastSuccessAt);
  const updatedAtMin = incremental
    ? new Date(new Date(String(previous?.lastSuccessAt)).getTime() - 5 * 60_000).toISOString()
    : undefined;
  await db.collection(collections.settings).updateOne(
    { id: "haravan_sync" },
    { $set: { status: "running", startedAt: startedAt.toISOString() } },
    { upsert: true },
  );
  try {
    const [customerBatch, orderBatch] = await Promise.all([
      fetchPages<HaravanCustomer>(
        "customers",
        config.haravanAccessToken,
        updatedAtMin,
        incremental ? 1 : Number(previous?.customerPage || 1),
      ),
      fetchPages<HaravanOrder>(
        "orders",
        config.haravanAccessToken,
        updatedAtMin,
        incremental ? 1 : Number(previous?.orderPage || 1),
      ),
    ]);
    const customers = customerBatch.rows;
    const orders = orderBatch.rows;
    const customerMap = new Map<string, { id: string; owner: string }>();
    for (let offset = 0; offset < customers.length; offset += 10) {
      const batch = customers.slice(offset, offset + 10);
      const mapped = await Promise.all(
        batch.map(async (customer) => ({
          key: String(customer.id),
          value: await upsertCustomer(customer),
        })),
      );
      mapped.forEach((item) => customerMap.set(item.key, item.value));
    }
    const sortedOrders = orders.sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || "")),
    );
    for (let offset = 0; offset < sortedOrders.length; offset += 10) {
      const batch = sortedOrders.slice(offset, offset + 10);
      await Promise.all(batch.map(async (order) => {
      const rawCustomer =
        order.customer || ({ id: `order-${order.id}` } as HaravanCustomer);
      let mapped = rawCustomer.id ? customerMap.get(String(rawCustomer.id)) : undefined;
      if (!mapped) {
        const address = order.shipping_address || order.billing_address;
        mapped = await upsertCustomer(rawCustomer, {
          name: address?.name,
          phone: address?.phone,
        });
        if (rawCustomer.id) customerMap.set(String(rawCustomer.id), mapped);
      }
      const status = order.cancelled_at
        ? "Hủy"
        : ["refunded", "partially_refunded"].includes(order.financial_status || "")
          ? "Trả hàng"
          : "Mua hàng";
      const document = {
        id: `HRV-DH-${order.id}`,
        haravanId: String(order.id),
        code: order.name || `#${order.order_number || order.id}`,
        customerId: mapped.id,
        orderDate: order.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        channel: order.source_name || "Haravan",
        location: "Haravan",
        customerSource: order.landing_site_ref || "Haravan",
        purchaseType: "Mua mới",
        status,
        products: (order.line_items || []).map((item) => ({
          sku: item.sku || "",
          name: item.title || item.name || "Sản phẩm",
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.price || 0),
          discount: Number(item.total_discount || 0),
        })),
        promotion: Number(order.total_discounts || 0) ? "Có giảm giá" : "",
        total: Number(order.total_price || 0),
        owner: mapped.owner,
        salesperson: mapped.owner,
        paymentMethod: order.gateway || "",
        haravanUpdatedAt: order.updated_at || "",
        source: "haravan",
        syncedAt: new Date().toISOString(),
      };
      const existingOrder = await db.collection(collections.orders).findOne({
        $or: [
          { haravanId: String(order.id) },
          { code: document.code },
        ],
      });
      if (existingOrder?.id) document.id = String(existingOrder.id);
      await db.collection(collections.orders).updateOne(
        existingOrder?._id
          ? { _id: existingOrder._id }
          : { haravanId: String(order.id) },
        { $set: document },
        { upsert: true },
      );
      }));
    }
    const affectedCustomerIds = [...new Set(customerMap.values().map((item) => item.id))];
    for (let offset = 0; offset < affectedCustomerIds.length; offset += 20) {
      await Promise.all(affectedCustomerIds.slice(offset, offset + 20).map(async (customerId) => {
      const customerOrders = await db
        .collection(collections.orders)
        .find({ customerId, status: "Mua hàng" })
        .sort({ orderDate: 1, code: 1 })
        .project({ id: 1 })
        .toArray();
      await Promise.all(
        customerOrders.map((order, index) =>
          db.collection(collections.orders).updateOne(
            { id: order.id },
            { $set: { purchaseType: index === 0 ? "Mua mới" : "Mua lại" } },
          ),
        ),
      );
      }));
    }
    const finishedAt = new Date();
    const result = {
      customers: customers.length,
      orders: orders.length,
      totalCustomers: customerBatch.total,
      totalOrders: orderBatch.total,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      incremental,
      complete: customerBatch.done && orderBatch.done,
    };
    if (result.complete || incremental) await reconcileCustomers();
    await db.collection(collections.settings).updateOne(
      { id: "haravan_sync" },
      {
        $set: {
          ...result,
          status: "success",
          customerPage: result.complete ? 1 : customerBatch.nextPage,
          orderPage: result.complete ? 1 : orderBatch.nextPage,
          lastSuccessAt: finishedAt.toISOString(),
        },
        $unset: { error: "" },
      },
      { upsert: true },
    );
    return result;
  } catch (error) {
    await db.collection(collections.settings).updateOne(
      { id: "haravan_sync" },
      { $set: { status: "failed", error: error instanceof Error ? error.message : "Đồng bộ thất bại", finishedAt: new Date().toISOString() } },
      { upsert: true },
    );
    throw error;
  }
}

export async function getHaravanSyncStatus() {
  if (!hasDatabase()) return null;
  const row = await (await getDatabase())
    .collection(collections.settings)
    .findOne({ id: "haravan_sync" }, { projection: { _id: 0 } });
  if (!row) return null;
  return {
    status: String(row.status || "idle"),
    lastSuccessAt: String(row.lastSuccessAt || ""),
    customers: Number(row.customers || 0),
    orders: Number(row.orders || 0),
    error: String(row.error || ""),
    complete: Boolean(row.complete),
  };
}
