import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: { email: "admin@nichiei.vn", password: "Nichiei@2026" } })).ok()).toBeTruthy();
});
const customers = [{ id: "K1", name: "Khách A", phone: "0901234567", owner: "Vân Anh" }, { id: "K2", name: "Khách B", phone: "0907654321", owner: "Vân Anh" }];
test("care form only loads orders for the selected customer and switches without stale orders", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/form-options?**", async route => {
    const url = new URL(route.request().url()), id = url.searchParams.get("customerId");
    if (!id) return route.fulfill({ json: { customers, orders: [], employees: [{ id: "u", name: "Vân Anh" }], products: [], loadOrdersOnDemand: true } });
    requested.push(id);
    return route.fulfill({ json: { orders: [{ id: "O-" + id, code: "#" + id, customerId: id, orderDate: "2026-11-01", products: [{ sku: "P", name: "Sản phẩm", quantity: 1 }] }] } });
  });
  await page.goto("/care"); await page.getByRole("button", { name: "Tạo lịch chăm sóc", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Đơn hàng", exact: true }).locator('option[value="O-K1"]')).toHaveCount(1);
  await dialog.getByRole("combobox", { name: "Khách hàng", exact: true }).selectOption("K2");
  await expect(dialog.getByRole("combobox", { name: "Đơn hàng", exact: true }).locator('option[value="O-K2"]')).toHaveCount(1);
  await expect(dialog.getByRole("combobox", { name: "Đơn hàng", exact: true }).locator('option[value="O-K1"]')).toHaveCount(0);
  expect(requested).toEqual(["K1", "K2"]);
});
test("ticket order loading failures are retryable and prevent saving an incomplete form", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/form-options?**", async route => {
    const id = new URL(route.request().url()).searchParams.get("customerId");
    if (!id) return route.fulfill({ json: { customers, orders: [], products: [], employees: [{ id: "u", name: "Vân Anh" }], loadOrdersOnDemand: true } });
    calls++;
    return calls === 1 ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.fulfill({ json: { orders: [] } });
  });
  await page.goto("/tickets"); await page.getByRole("button", { name: "Tạo phiếu yêu cầu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Tạo phiếu", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Tải lại đơn" }).click();
  await expect(dialog.getByRole("button", { name: "Tạo phiếu", exact: true })).toBeEnabled();
});
test("invalid report ranges render safely and invalid export dates return 400", async ({ page }) => {
  await page.goto("/reports?from=2026-02-31&to=2026-03-01");
  await expect(page.getByRole("heading", { name: "Khoảng ngày không hợp lệ" })).toBeVisible();
  expect((await page.request.get("/api/reports/export?from=2026-02-31&to=2026-03-01")).status()).toBe(400);
  await page.goto("/reports?from=2026-11-20&to=2026-11-01");
  await expect(page.getByRole("heading", { name: "Khoảng ngày không hợp lệ" })).toBeVisible();
});
