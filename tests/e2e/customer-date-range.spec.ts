import { expect, test } from "@playwright/test";

test("sales can filter exact day ranges and use month shortcuts", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: { email: process.env.E2E_SALE_EMAIL || "sale@nichiei.vn", password: process.env.E2E_SALE_PASSWORD || "Sale@2026" } });
  expect(login.ok()).toBeTruthy();
  await page.goto("/customers?from=2026-11-01&to=2026-11-20");
  await expect(page.getByLabel("Từ ngày", { exact: true })).toHaveValue("2026-11-01");
  await expect(page.getByLabel("Đến ngày", { exact: true })).toHaveValue("2026-11-20");
  const total = await page.locator(".customer-summary-strip b").first().innerText();
  expect(Number(total)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Tháng trước", exact: true }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}/);
  await page.goto("/customers?from=2026-11&to=2026-11");
  await expect(page.getByLabel("Đến ngày", { exact: true })).toHaveValue("2026-11-30");
  await page.goto("/customers?from=2026-11-20&to=2026-11-01");
  await expect(page.locator(".form-error[role=alert]")).toContainText("Ngày kết thúc");
});
