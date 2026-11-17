import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: {
    email: process.env.E2E_ADMIN_EMAIL || "admin@nichiei.vn",
    password: process.env.E2E_ADMIN_PASSWORD || "Nichiei@2026",
  } })).ok()).toBeTruthy();
});

test("create can be reopened after success without leaving the submit button locked", async ({ page }) => {
  await page.route("**/api/customers", async route => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 201, json: { data: { id: "mock-only-no-database-write" } } });
  });
  await page.goto("/customers");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Thêm khách hàng", exact: true }).click();
    const form = page.locator(".modal-card form");
    await expect(form.getByRole("button", { name: "Tạo khách hàng", exact: true })).toBeEnabled();
    await form.locator('[name="name"]').fill("Kiểm thử giả lập, không lưu dữ liệu");
    await form.locator('[name="phone"]').fill("0900000000");
    await form.getByRole("button", { name: "Tạo khách hàng", exact: true }).click();
    await expect(form).toBeHidden();
  }
});

test("failed requests keep the content and allow retry", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/customers", async route => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    if (attempts === 1) return route.abort("failed");
    if (attempts === 2) return route.fulfill({ status: 409, json: { error: "Số điện thoại đã tồn tại." } });
    return route.fulfill({ status: 201, json: { data: { id: "mock-only-no-database-write" } } });
  });
  await page.goto("/customers");
  await page.getByRole("button", { name: "Thêm khách hàng", exact: true }).click();
  const form = page.locator(".modal-card form");
  await form.locator('[name="name"]').fill("Kiểm thử giữ nội dung");
  await form.locator('[name="phone"]').fill("0900000000");
  const submit = form.getByRole("button", { name: "Tạo khách hàng", exact: true });
  await submit.click();
  await expect(form.locator(".form-error")).toContainText("Chưa nhận được xác nhận lưu");
  await expect(submit).toBeEnabled();
  await expect(form.locator('[name="name"]')).toHaveValue("Kiểm thử giữ nội dung");
  await submit.click();
  await expect(form.locator(".form-error")).toContainText("Số điện thoại đã tồn tại");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(form).toBeHidden();
});

test("customer page clamps before fetching rows and keeps filters", async ({ page }) => {
  await page.goto("/customers?page=999999");
  const total = Number(await page.locator(".customer-summary-strip b").first().innerText());
  const lastPage = Math.max(1, Math.ceil(total / 20));
  const expectedRows = total ? total - (lastPage - 1) * 20 : 0;
  await expect(page.locator("tbody tr")).toHaveCount(expectedRows);
  await expect(page.locator(".pagination .chip")).toHaveText(`${lastPage}/${lastPage}`);
  if (total) await expect(page.locator(".pagination")).toContainText(`Hiển thị ${(lastPage - 1) * 20 + 1}–${total}`);
  for (const invalid of ["-5", "1.5", "Infinity", "abc"]) {
    await page.goto(`/customers?page=${invalid}`);
    await expect(page.locator(".pagination .chip")).toHaveText(`1/${lastPage}`);
    await expect(page.locator("tbody tr")).toHaveCount(Math.min(total, 20));
  }
  await page.goto("/customers?status=overdue&sort=newest&page=999999");
  const filteredTotal = Number(await page.locator(".customer-summary-strip b").first().innerText());
  const filteredLast = Math.max(1, Math.ceil(filteredTotal / 20));
  await expect(page.locator("tbody tr")).toHaveCount(filteredTotal ? filteredTotal - (filteredLast - 1) * 20 : 0);
  await expect(page.locator('[name="status"]')).toHaveValue("overdue");
  await expect(page.locator('[name="sort"]')).toHaveValue("newest");
  await page.goto("/customers?q=__no_customer_for_regression_1611__&page=999999");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await expect(page.locator(".pagination")).toContainText("Hiển thị 0–0 trên 0 khách hàng");
  await expect(page.locator(".pagination .chip")).toHaveText("1/1");
});
