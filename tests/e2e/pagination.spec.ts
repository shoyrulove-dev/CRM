import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/auth/login", { data: {
    email: process.env.E2E_ADMIN_EMAIL || "admin@nichiei.vn",
    password: process.env.E2E_ADMIN_PASSWORD || "Nichiei@2026",
  } });
  expect(response.ok()).toBeTruthy();
});

test("care pages are bounded and keep filters", async ({ page }) => {
  await page.goto("/care?status=overdue");
  const nav = page.getByRole("navigation", { name: "Phân trang danh sách" });
  await expect(nav).toContainText("1–20 /");
  expect(await page.locator(".care-row").count()).toBeLessThanOrEqual(20);
  await nav.getByRole("link", { name: "Sau", exact: true }).click();
  await expect(page).toHaveURL(/status=overdue.*page=2/);
  await expect(nav).toContainText("21–40 /");
  await nav.getByRole("link", { name: "Trước", exact: true }).click();
  await expect(nav).toContainText("1–20 /");
});

test("customer history is paginated independently", async ({ page }) => {
  await page.goto("/customers/KH-0764?tab=reminders");
  const nav = page.getByRole("navigation", { name: "Phân trang danh sách" });
  await expect(nav).toBeVisible();
  if (await nav.getByRole("link", { name: "Sau", exact: true }).count()) {
    await nav.getByRole("link", { name: "Sau", exact: true }).click();
    await expect(page).toHaveURL(/tab=reminders.*page=2/);
    await expect(nav).toContainText("11–");
  }
});

test("tickets clamp invalid pages and keep the list usable", async ({ page }) => {
  await page.goto("/tickets?page=999999");
  const nav = page.getByRole("navigation", { name: "Phân trang danh sách" });
  await expect(nav).toBeVisible();
  expect(await page.locator("tbody tr").count()).toBeLessThanOrEqual(20);
  await expect(nav.getByRole("link", { name: "Sau", exact: true })).toHaveCount(0);
});
