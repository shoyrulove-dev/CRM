import { expect, test } from "@playwright/test";

const baseRow = {
  name: "Khách kiểm thử", phone: "0901234567", customerId: "KH-TEST", customerName: "Khách kiểm thử", customerOwner: "Sale A",
  errors: [] as string[], warnings: [] as string[],
  data: { occurredAt: "2026-10-05T17:00:00.000Z", dateOnly: true, employee: "Sale A", channel: "Zalo", purpose: "Chăm sóc khách trung thành", result: "Đang dùng - hài lòng", note: "" },
};
async function adminLogin(page: import("@playwright/test").Page) {
  expect((await page.request.post("/api/auth/login", { data: {
    email: process.env.E2E_ADMIN_EMAIL || "admin@nichiei.vn", password: process.env.E2E_ADMIN_PASSWORD || "Nichiei@2026",
  } })).ok()).toBeTruthy();
}
test("admin previews, explicitly acknowledges warnings and confirms selected rows without real writes", async ({ page }) => {
  await adminLogin(page);
  let commits = 0;
  await page.route("**/api/activities/import", async route => {
    if (route.request().method() === "POST") return route.fulfill({ json: { data: {
      batchId: "preview-test", expiresAt: "2099-01-01T00:00:00Z", rows: [
        { ...baseRow, row: 2, status: "ready" },
        { ...baseRow, row: 3, status: "warning", warnings: ["Cần kiểm tra ngày trong Excel."] },
        { ...baseRow, row: 4, status: "duplicate", warnings: ["Nghi trùng."] },
        { ...baseRow, row: 5, status: "error", errors: ["Không tìm thấy khách."] },
      ],
    } } });
    if (route.request().method() === "PUT") {
      commits++;
      expect(route.request().postDataJSON()).toEqual({ batchId: "preview-test", rows: [2, 3], acknowledgeWarnings: true });
      return route.fulfill({ json: { data: { inserted: 2, skipped: 0, results: [] } } });
    }
    return route.continue();
  });
  await page.goto("/customers");
  await page.getByRole("button", { name: "Nhập dữ liệu khách hàng" }).click();
  await page.getByRole("button", { name: "Nhật ký CSKH" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "sample.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("mock-file") });
  await page.getByRole("button", { name: "Kiểm tra và xem trước" }).click();
  await expect(page.getByLabel("Chọn dòng 2", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Chọn dòng 3", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Chọn dòng 4", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Chọn dòng 5", { exact: true })).toBeDisabled();
  await page.getByLabel("Chọn dòng 3", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Xác nhận nhập 2 dòng" })).toBeDisabled();
  await page.getByLabel(/Tôi đã kiểm tra đúng khách/).check();
  await page.getByRole("button", { name: "Xác nhận nhập 2 dòng" }).click();
  await expect(page.getByRole("status")).toContainText("Đã thêm 2 nhật ký");
  expect(commits).toBe(1);
});
test("failed preview can be retried and a new file resets the preview", async ({ page }) => {
  await adminLogin(page); let attempts = 0;
  await page.route("**/api/activities/import", async route => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 400, json: { error: "File cần kiểm tra lại." } })
      : route.fulfill({ json: { data: { batchId: "x", expiresAt: "2099-01-01", rows: [{ ...baseRow, row: 2, status: "ready" }] } } });
  });
  await page.goto("/customers");
  await page.getByRole("button", { name: "Nhập dữ liệu khách hàng" }).click();
  await page.getByRole("button", { name: "Nhật ký CSKH" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "test.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("mock") });
  await page.getByRole("button", { name: "Kiểm tra và xem trước" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("File cần kiểm tra lại.");
  await page.getByRole("button", { name: "Kiểm tra và xem trước" }).click();
  await expect(page.getByRole("button", { name: "Xác nhận nhập 1 dòng" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "other.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("mock") });
  await expect(page.getByRole("button", { name: /Xác nhận nhập/ })).toHaveCount(0);
});
test("sales cannot see import or access any import method", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: { email: "sale@nichiei.vn", password: "Sale@2026" } })).ok()).toBeTruthy();
  await page.goto("/customers"); await expect(page.getByRole("button", { name: "Nhập dữ liệu khách hàng" })).toHaveCount(0);
  expect((await page.request.get("/api/activities/import")).status()).toBe(403);
  expect((await page.request.post("/api/activities/import")).status()).toBe(403);
  expect((await page.request.put("/api/activities/import", { data: {} })).status()).toBe(403);
});
