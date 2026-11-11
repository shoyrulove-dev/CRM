import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@nichiei.vn");
  await page.locator('input[type="password"]').fill("Nichiei@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
});
test("các trang CRM và chuông thông báo hoạt động", async ({ page }) => {
  for (const path of [
    "/customers",
    "/care",
    "/tickets",
    "/reports",
    "/accounts",
    "/settings",
    "/help",
  ]) {
    await page.goto(path);
    await expect(page.locator("main, .page-content").first()).toBeVisible();
  }
  await page.getByLabel("Mở thông báo").click();
  await expect(page.getByText("Việc cần xử lý", { exact: true })).toBeVisible();
});
test("hồ sơ khách hàng có đủ bốn tab", async ({ page }) => {
  await page.goto("/customers/KH-1042");
  for (const name of [
    "Lịch sử bán hàng",
    "Lịch nhắc chăm sóc",
    "Lịch sử chăm sóc",
    "Phiếu yêu cầu",
  ])
    await expect(
      page
        .locator(".customer-tabs")
        .getByRole("link", { name: new RegExp(name) }),
    ).toBeVisible();
});

test("quản trị thấy các công cụ nâng cấp mới", async ({ page }) => {
  await page.goto("/customers");
  await expect(page.getByRole("button", { name: "Xuất Excel" })).toBeVisible();
  await expect(page.getByLabel("Từ tháng mua")).toBeVisible();
  await page.goto("/care");
  await expect(
    page.getByRole("button", { name: "Tạo hàng loạt" }),
  ).toBeVisible();
  await page.goto("/tickets");
  await expect(page.getByText("HƯỚNG XỬ LÝ", { exact: true })).toBeVisible();
  await page.goto("/accounts");
  await expect(
    page.getByRole("heading", { name: "Lịch sử đăng nhập" }),
  ).toBeVisible();
});

test("nhân viên bán hàng không được xuất dữ liệu tổng", async ({ page }) => {
  await page.request.post("/api/auth/logout");
  await page.goto("/login");
  await page.getByLabel("Email").fill("sale@nichiei.vn");
  await page.locator('input[type="password"]').fill("Sale@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  const response = await page.request.get("/api/customers/export");
  expect(response.status()).toBe(403);
});

test("danh sách khách và bộ lọc tháng hiển thị đúng yêu cầu", async ({
  page,
}) => {
  await page.goto("/customers");
  await expect(
    page.getByText("LẦN CHĂM GẦN NHẤT", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Từ tháng mua")).toHaveAttribute(
    "type",
    "month",
  );
  await page.goto("/care");
  await expect(page.getByLabel("Từ tháng")).toHaveAttribute("type", "month");
  await page.goto("/tickets");
  await expect(page.getByLabel("Từ tháng")).toHaveAttribute("type", "month");
  await page.goto("/accounts");
  await expect(page.getByRole("button", { name: /Đã lưu trữ/ })).toBeVisible();
});
