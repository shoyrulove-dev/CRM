const { mkdir } = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { MongoClient } = require("mongodb");
const { preview, normalizePhone } = require("./preview-purchase-history.cjs");

const classifications = {
  old: "Chỉ mua sản phẩm cũ",
  new: "Chỉ mua sản phẩm mới",
  mixed: "Mua cả cũ lẫn mới",
  unknown: "Chưa đủ dữ liệu",
};

function collectBaseline(byPhone, { phone, day, order, sku }) {
  let first = byPhone.get(phone);
  if (!first || day < first.day) {
    first = { day, orders: new Map() };
    byPhone.set(phone, first);
  }
  if (day !== first.day) return;
  const lines = first.orders.get(order) || new Set();
  lines.add(sku);
  first.orders.set(order, lines);
}

function classify(first, products) {
  if (first.orders.size !== 1 || first.orders.has("")) return "unknown";
  const baseline = first.orders.values().next().value;
  const codes = new Set((products || []).map(product => String(product.sku || "").trim().toUpperCase()));
  if (!baseline.size || baseline.has("") || !codes.size || codes.has("")) return "unknown";
  const matched = [...codes].filter(code => baseline.has(code)).length;
  return matched === 0 ? "new" : matched === codes.size ? "old" : "mixed";
}

async function reconcile(file, cutoff, directory, sheet) {
  const byPhone = new Map();
  const validation = await preview(file, sheet, cutoff, row => collectBaseline(byPhone, row));
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI for read-only CRM reconciliation.");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || "nichiei_crm");
    const matches = new Map();
    for await (const customer of db.collection("customers").find({}, { projection: { id: 1, phone: 1 } })) {
      const phone = normalizePhone(customer.phone);
      if (!byPhone.has(phone)) continue;
      const ids = matches.get(phone) || new Set();
      ids.add(customer.id);
      matches.set(phone, ids);
    }
    const candidates = new Map();
    let ambiguous = 0;
    for (const [phone, ids] of matches) {
      if (ids.size !== 1) { ambiguous++; continue; }
      const id = ids.values().next().value;
      if (id) candidates.set(id, byPhone.get(phone));
    }
    await mkdir(directory, { recursive: false });
    const dest = path.join(directory, "doi-chieu-mua-lai.xlsx");
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: dest });
    const detail = workbook.addWorksheet("Đơn đối chiếu");
    detail.addRow(["Mã đơn CRM", "Ngày mua", "Mã khách", "Nhân viên bán", "Doanh số", "Trước", "Sau", "Nhóm sản phẩm", "Ngày mua cũ", "Mã đơn cũ", "Lý do"]).commit();
    const summaries = new Map();
    let changed = 0, compared = 0;
    for await (const order of db.collection("orders").find({ status: "Mua hàng" }, {
      projection: { code: 1, customerId: 1, salesperson: 1, orderDate: 1, total: 1, purchaseType: 1, "products.sku": 1 },
    })) {
      const day = String(order.orderDate || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const first = candidates.get(order.customerId);
      const eligible = first && first.day < day;
      const before = order.purchaseType === "Mua lại";
      const after = before || Boolean(eligible);
      const amount = Number(order.total) || 0;
      const employee = order.salesperson || "Chưa xác định người bán";
      const year = day.slice(0, 4);
      const quarter = `${year}-Q${Math.ceil(Number(day.slice(5, 7)) / 3)}`;
      for (const period of [day, day.slice(0, 7), quarter, year]) for (const name of ["", employee]) {
        const key = JSON.stringify([period, name]);
        const row = summaries.get(key) || { orders: 0, before: 0, after: 0, beforeRevenue: 0, afterRevenue: 0, beforeBuyers: new Set(), afterBuyers: new Set() };
        row.orders++;
        if (before) { row.before++; row.beforeRevenue += amount; if (order.customerId) row.beforeBuyers.add(order.customerId); }
        if (after) { row.after++; row.afterRevenue += amount; if (order.customerId) row.afterBuyers.add(order.customerId); }
        summaries.set(key, row);
      }
      if (!eligible) continue;
      compared++;
      if (!before) changed++;
      const kind = classify(first, order.products);
      detail.addRow([order.code, day, order.customerId, employee, amount,
        order.purchaseType || "", "Mua lại", classifications[kind], first.day,
        first.orders.size === 1 ? first.orders.keys().next().value : "",
        "SĐT khớp duy nhất, có giao dịch cũ trước ngày mua CRM"]).commit();
    }
    detail.commit();
    const summary = workbook.addWorksheet("Trước và sau");
    summary.addRow(["Kỳ", "Nhân viên", "Tổng đơn mua", "Đơn mua lại trước", "Đơn mua lại sau", "Chênh lệch đơn", "Khách mua lại trước", "Khách mua lại sau", "Chênh lệch khách", "Doanh thu mua lại trước", "Doanh thu mua lại sau", "Chênh lệch doanh thu"]).commit();
    for (const [key, row] of [...summaries].sort(([a], [b]) => a.localeCompare(b))) {
      const [period, employee] = JSON.parse(key);
      summary.addRow([period, employee || "Tổng toàn đội", row.orders, row.before, row.after, row.after - row.before,
        row.beforeBuyers.size, row.afterBuyers.size, row.afterBuyers.size - row.beforeBuyers.size,
        row.beforeRevenue, row.afterRevenue, row.afterRevenue - row.beforeRevenue]).commit();
    }
    summary.commit();
    await workbook.commit();
    return { ...validation, matched: candidates.size, ambiguous, unmatched: byPhone.size - matches.size, comparedOrders: compared, changedOrders: changed, output: dest };
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  const [, , file, cutoff, directory, sheet] = process.argv;
  if (!file || !directory || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff || "")) {
    console.error("Usage: node scripts/reconcile-purchase-history.cjs <xlsx> <YYYY-MM-DD cutoff> <new output directory> [sheet]");
    process.exitCode = 1;
  } else {
    reconcile(file, cutoff, directory, sheet).then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = { collectBaseline, classify };
