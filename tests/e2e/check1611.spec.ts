import { expect, test } from "@playwright/test";
import { monthStart, monthEnd, monthBounds } from "../../src/lib/month-range";
import { customerSegments, healthGoals } from "../../src/lib/customer-options";

test("month ranges respect leap years and Vietnam timezone", () => {
  expect(monthEnd("2024-02")).toBe("2024-02-29");
  expect(monthEnd("2026-02")).toBe("2026-02-28");
  expect(monthEnd("2026-04")).toBe("2026-04-30");
  expect(monthStart("2026-13")).toBeUndefined();
  expect(monthBounds("2026-02", "2026-02")).toEqual({ $gte: "2026-01-31T17:00:00.000Z", $lte: "2026-02-28T16:59:59.999Z" });
});

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: { email: process.env.E2E_ADMIN_EMAIL || "admin@nichiei.vn", password: process.env.E2E_ADMIN_PASSWORD || "Nichiei@2026" } })).ok()).toBeTruthy();
});

test("classification lists and catalog contain the agreed choices", async ({ page }) => {
  await page.goto("/customers");
  await page.getByRole("button", { name: "Thêm khách hàng", exact: true }).click();
  const form = page.locator(".modal-card form");
  await expect(form.locator('[name="segment"] option')).toHaveText(customerSegments);
  await expect(form.locator('[name="healthGoal"] option')).toHaveText(healthGoals);
  const options = await (await page.request.get("/api/form-options?kind=tickets")).json();
  expect(options.products).toHaveLength(26);
  expect(new Set(options.products.map((item: { sku: string }) => item.sku)).size).toBe(26);
  expect(options.products.every((item: { sku: string }) => !item.sku.startsWith("NIC-"))).toBeTruthy();
  expect(options.products.map((item: { sku: string }) => item.sku)).toEqual(expect.arrayContaining(["HH027", "HH032", "HH022_ACT6", "HH025_ACT2"]));
});

test("month selectors, shortcuts and sorting work without blank month inputs", async ({ page }) => {
  for (const path of ["/customers", "/care", "/tickets"]) {
    await page.goto(path);
    await expect(page.locator('select[name="from"]')).toBeVisible();
    await expect(page.locator('input[type="month"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Tháng trước", exact: true }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}.*to=\d{4}-\d{2}/);
    await expect(page.locator('select[name="from"]')).not.toHaveValue("");
    await page.getByRole("link", { name: "Xóa lọc", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
  await page.goto("/customers?sort=newest");
  await expect(page.getByLabel("Sắp xếp khách hàng")).toHaveValue("newest");
  await expect(page.locator(".customer-loyalty").first()).toContainText("Chưa đồng bộ");
});

test("status totals count all matching customers rather than the current page", async ({ page }) => {
  const data = (await (await page.request.get("/api/customers")).json()).data;
  await page.goto("/customers");
  const due = data.filter((item: { status: string }) => item.status === "due").length;
  const overdue = data.filter((item: { status: string }) => item.status === "overdue").length;
  await expect(page.locator('.filter-chips a[href*="status=due"] b')).toHaveText(String(due));
  await expect(page.locator('.filter-chips a[href*="status=overdue"] b')).toHaveText(String(overdue));
  await page.goto("/customers?status=overdue");
  await expect(page.locator(".filter-chips a").first().locator("b")).toHaveText(String(data.length));
});

test("sales and care only see assigned customers; invalid classifications are rejected", async ({ playwright, page, baseURL }) => {
  const contexts = [];
  try {
    for (const [email, password] of [["sale@nichiei.vn", "Sale@2026"], ["cskh@nichiei.vn", "CSKH@2026"]]) {
      const context = await playwright.request.newContext({ baseURL });
      contexts.push(context);
      const response = await context.post("/api/auth/login", { data: { email, password } });
      expect(response.ok()).toBeTruthy();
      const user = (await response.json()).user;
      const customers = (await (await context.get("/api/customers")).json()).data;
      expect(customers.every((item: { owner: string }) => item.owner === user.name)).toBeTruthy();
      expect((await context.get("/api/settings")).status()).toBe(403);
    }
    // An invalid choice must be rejected before any database write.
    const response = await page.request.post("/api/customers", { data: { name: "Kiểm tra dữ liệu không hợp lệ", phone: "0900000000", segment: "Nhóm không tồn tại", healthGoal: "Khác" } });
    expect(response.status()).toBe(400);
  } finally {
    await Promise.all(contexts.map(context => context.dispose()));
  }
});
