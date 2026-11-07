import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@nichiei.vn");
  await page.locator('input[type="password"]').fill("Nichiei@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/$/);
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
