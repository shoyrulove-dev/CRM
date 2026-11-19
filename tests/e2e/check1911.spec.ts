import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: { email: process.env.E2E_ADMIN_EMAIL || "admin@nichiei.vn", password: process.env.E2E_ADMIN_PASSWORD || "Nichiei@2026" } })).ok()).toBeTruthy();
});
test("bulk assignment separates audience and assignee, has weekly quarterly custom choices", async ({ page }) => {
  await page.route("**/api/care/bulk", async route => {
    const body = route.request().postDataJSON();
    expect(body.assignToCustomerOwner).toBe(true); expect(body.filterOwner).toBe(""); expect(body.owner).toBeNull();
    expect(body.recurrence).toBe("quarterly");
    return route.fulfill({ json: { count: 1250, unassigned: 10 } });
  });
  await page.goto("/care"); await page.getByRole("button", { name: "Tạo hàng loạt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[name="owner"]')).toHaveCount(0);
  await dialog.locator('[name="assignMode"]').selectOption("one"); await expect(dialog.locator('[name="owner"]')).toBeVisible();
  await dialog.locator('[name="assignMode"]').selectOption("customer");
  await dialog.locator('[name="dueAt"]').fill("2026-12-01T09:00");
  await expect(dialog.locator('[name="recurrence"] option')).toHaveCount(6);
  await dialog.locator('[name="recurrence"]').selectOption("quarterly");
  page.once("dialog", async confirm => { expect(confirm.message()).toContain("1250"); await confirm.dismiss(); });
  await dialog.getByRole("button", { name: "Kiểm tra và tạo lịch" }).click();
  await expect(dialog.getByRole("button", { name: "Kiểm tra và tạo lịch" })).toBeEnabled();
});
test("assignment uses a real dialog and recovers from failure", async ({ page }) => {
  const customer = (await (await page.request.get("/api/customers")).json()).data[0];
  let writes = 0;
  await page.route(`**/api/customers/${customer.id}`, async route => {
    if (route.request().method() !== "PATCH") return route.continue();
    writes++; if (writes === 1) return route.fulfill({ status: 400, json: { error: "Nhân viên không hợp lệ" } });
    return route.fulfill({ json: { data: customer } });
  });
  await page.goto(`/customers/${customer.id}`);
  await page.getByRole("button", { name: "Phân công", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Giữ nguyên nhân viên bán hàng trong đơn cũ.", { exact: false })).toBeVisible();
  await dialog.locator('select[name="owner"]').selectOption("Chưa phân công");
  await dialog.getByRole("button", { name: "Lưu phân công", exact: true }).click();
  await expect(dialog).toContainText("Nhân viên không hợp lệ");
  await expect(dialog.getByRole("button", { name: "Lưu phân công", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Lưu phân công", exact: true }).click();
  await expect(dialog).toBeHidden();
});
test("program management loads pagination and sends pause and automation changes", async ({ page }) => {
  const program = { id: "mock", purpose: "Khảo sát sau mua", channel: "Zalo", targetCount: 1250, created: 1000, skipped: 0, cursor: 1000, nextDueAt: "2026-12-01T02:00:00Z", status: "active", recurrence: "quarterly", intervalDays: 7, endDate: "", assignToCustomerOwner: true };
  let paused = false;
  await page.route("**/api/care/programs?*", route => route.fulfill({ json: { items: [{ ...program, status: paused ? "paused" : "active" }], page: 1, pages: 2, automation: { orders: false, birthdays: false, holidays: false, activeFrom: "2026-11-19T00:00:00Z", orderRules: [] } } }));
  await page.route("**/api/care/programs", async route => {
    expect(route.request().method()).toBe("PATCH"); const body = route.request().postDataJSON(); expect(body).toEqual({ id: "mock", status: "paused" }); paused = true;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/care"); await page.getByRole("button", { name: "Chương trình chăm sóc", exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("1250 khách");
  await dialog.getByRole("button", { name: "Tạm dừng", exact: true }).click(); await expect(dialog.getByRole("button", { name: "Tiếp tục", exact: true })).toBeVisible();
  await dialog.locator("summary").click(); await expect(dialog.getByRole("button", { name: "Lưu lịch tự động" })).toBeVisible();
});
test("reports distinguish period and lifetime with visible formula", async ({ page }) => {
  await page.goto("/reports?from=2026-11-01&to=2026-11-19");
  await expect(page.getByText("Khách có đơn mua trong kỳ", { exact: true })).toBeVisible();
  await expect(page.getByText("Khách từng mua — lũy kế đến cuối kỳ", { exact: true })).toBeVisible();
  await expect(page.locator(".report-formula")).toContainText("không chứng minh doanh thu phát sinh nhờ CSKH");
});
test("sales cannot manage care programs or bulk assignments", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: { email: "sale@nichiei.vn", password: "Sale@2026" } })).ok()).toBeTruthy();
  expect((await page.request.get("/api/care/programs")).status()).toBe(403);
  expect((await page.request.patch("/api/care/programs", { data: {} })).status()).toBe(403);
  expect((await page.request.post("/api/care/bulk", { data: {} })).status()).toBe(403);
});
