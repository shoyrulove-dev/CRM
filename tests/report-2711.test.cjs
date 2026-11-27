const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");

const modules = {};
for (const name of ["month-range", "report-filters", "order-report-adjustment", "haravan-order-values", "customer-report-metrics"]) {
  const exports = {};
  const source = fs.readFileSync(`src/lib/${name}.ts`, "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: key => modules[key] });
  modules[`./${name}`] = exports;
}
const { haravanDeliveryState, haravanShippingFee } = modules["./haravan-order-values"];
const { effectiveReportOrders } = modules["./order-report-adjustment"];
const { classifyPurchases, summarizePurchases } = modules["./customer-report-metrics"];
const purchase = { id: "a", customerId: "c", code: "#A", orderDate: "2026-11-27", owner: "Trâm",
  total: 2010000, shippingFee: 20000, status: "Mua hàng", purchaseType: "Mua lại", channel: "web", products: [] };

test("verified Haravan samples distinguish returned, not shipped and ready for pickup", () => {
  const returned = haravanDeliveryState("fulfilled", [{ status: "success", carrier_status_code: "return" }]);
  const notShipped = haravanDeliveryState("notfulfilled", []);
  const ready = haravanDeliveryState("fulfilled", [{ status: "success", carrier_status_code: "readytopick" }]);
  assert.equal(returned, "returned");
  assert.equal(notShipped, "not_shipped");
  assert.equal(ready, "ready");
  assert.equal(haravanShippingFee([{ price: 20000 }]), 20000);
  const eligible = effectiveReportOrders([returned, notShipped, ready].map(deliveryState => ({ ...purchase, deliveryState })));
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].total, 1990000);
});

test("marketplace requires approval and return still supersedes a report adjustment", () => {
  const marketplace = { ...purchase, channel: "Google Shop" };
  assert.equal(effectiveReportOrders([marketplace]).length, 0);
  const approved = { ...marketplace, reportAdjustment: { manualChannelApproved: true } };
  assert.equal(effectiveReportOrders([approved]).length, 1);
  assert.equal(effectiveReportOrders([{ ...approved, deliveryState: "returned" }]).length, 0);
});

test("50/50 allocations split sales while counting one order and full repeat revenue for primary", () => {
  const order = { ...purchase, total: 5000000, shippingFee: 0,
    reportAdjustment: { shares: [{ employee: "Trâm", percent: 50 }, { employee: "Phước An", percent: 50 }] } };
  const rows = summarizePurchases(classifyPurchases(effectiveReportOrders([order])), "2026-11-01", "2026-11-30", "", "month");
  const primary = rows.find(row => row[1] === "Trâm");
  const support = rows.find(row => row[1] === "Phước An");
  const total = rows.find(row => row[1] === "Tổng toàn đội");
  assert.equal(primary[2], 1);
  assert.equal(primary[3], 2500000);
  assert.equal(primary[12], 5000000);
  assert.equal(support[2], 0);
  assert.equal(support[3], 2500000);
  assert.equal(support[12], 0);
  assert.equal(total[3], 5000000);
});
