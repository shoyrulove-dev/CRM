import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

const damaged = /\uFFFD|[\u00C3\u00C4\u00C6][\u0080-\u00BF]|\u00E1[\u00BA\u00BB]|\u00E2[\u0080\u20AC]/;
test.beforeEach(async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: {
    email: process.env.E2E_ADMIN_EMAIL || "admin@nichiei.vn",
    password: process.env.E2E_ADMIN_PASSWORD || "Nichiei@2026",
  } });
  expect(login.ok()).toBeTruthy();
});

test("tiếng Việt đúng trên các trang và lịch sử đăng nhập", async ({ page }) => {
  for (const path of ["/", "/customers", "/care", "/tickets", "/reports", "/accounts?loginPage=2", "/settings", "/help"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await page.locator("body").innerText(), path).not.toMatch(damaged);
    expect(await page.locator("body").innerText(), path).not.toContain("Admin ki?m th?");
  }
});

test("tạo phiếu từ hồ sơ giữ đúng khách và lưu tiếng Việt", async ({ page }) => {
  const customers = await (await page.request.get("/api/customers")).json();
  const customer = customers.data.find((item: { owner: string }) => item.owner === "Vân Anh");
  expect(customer).toBeTruthy();
  await page.goto(`/customers/${customer.id}`);
  await page.getByRole("button", { name: "Tạo phiếu yêu cầu", exact: true }).first().click();
  const form = page.locator(".modal-card .entity-form");
  const title = `Kiểm thử tiếng Việt ${Date.now()}`;
  await form.getByLabel("Nội dung", { exact: true }).fill(title);
  await form.getByLabel("Mô tả", { exact: true }).fill("Khách muốn được hướng dẫn sử dụng đúng cách.");
  await form.getByLabel("Hướng xử lý").selectOption("Khác");
  const createdResponse = page.waitForResponse((response) => response.url().endsWith("/api/tickets") && response.request().method() === "POST");
  await form.getByRole("button", { name: "Tạo phiếu", exact: true }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const { data: ticket } = await response.json();
  try {
    expect(ticket.customerId).toBe(customer.id);
    expect(ticket.customer).toBe(customer.name);
    expect(ticket.title).toBe(title);
    expect(ticket.owner).toBe(customer.owner);
    await expect(await page.request.patch(`/api/tickets/${ticket.id}`, { data: { note: "Đã hướng dẫn và hẹn gọi lại." } })).toBeOK();
    await expect(await page.request.patch(`/api/tickets/${ticket.id}`, { data: { status: "Đã đóng" } })).toBeOK();
    const locked = await page.request.patch(`/api/tickets/${ticket.id}`, { data: { note: "Không được thay đổi phiếu đã đóng" } });
    expect(locked.status()).toBe(409);
  } finally { await expect(await page.request.delete(`/api/tickets/${ticket.id}`)).toBeOK(); }
});

test("chặn ký tự hỏng và chặn nhân viên sửa phiếu ngoài phạm vi", async ({ page, playwright, baseURL }) => {
  const sales = await playwright.request.newContext({ baseURL });
  const care = await playwright.request.newContext({ baseURL });
  let id = "";
  try {
    const salesLogin = await sales.post("/api/auth/login", { data: { email: "sale@nichiei.vn", password: "Sale@2026" } });
    expect(salesLogin.ok()).toBeTruthy();
    const salesperson = (await salesLogin.json()).user;
    expect((await care.post("/api/auth/login", { data: { email: "cskh@nichiei.vn", password: "CSKH@2026" } })).ok()).toBeTruthy();
    const customer = (await (await sales.get("/api/customers")).json()).data[0];
    const corrupted = await page.request.post("/api/tickets", { data: { customerId: customer.id, title: "Kiểm th\uFFFD", owner: salesperson.name } });
    expect(corrupted.status()).toBe(400);
    const created = await sales.post("/api/tickets", { data: { customerId: customer.id, title: "Kiểm thử phạm vi phụ trách", resolution: "Khác" } });
    expect(created.status()).toBe(201);
    const ticket = (await created.json()).data; id = ticket.id;
    expect(ticket.owner).toBe(salesperson.name);
    expect((await care.patch(`/api/tickets/${id}`, { data: { note: "Khác nhân viên" } })).status()).toBe(404);
    expect((await sales.patch(`/api/tickets/${id}`, { data: { owner: "Linh" } })).status()).toBe(403);
    expect((await sales.patch(`/api/tickets/${id}`, { data: { status: "Không hợp lệ" } })).status()).toBe(400);
    expect((await care.patch(`/api/customers/${customer.id}`, { data: { segment: "Khác" } })).status()).toBe(404);
    await page.goto(`/customers/${customer.id}`);
    await page.getByLabel("Cập nhật phân nhóm", { exact: true }).click();
    await expect(page.locator('.entity-form input[name="segment"]')).toHaveValue(customer.segment);
    await expect(page.locator('.entity-form input[name="healthGoal"]')).toHaveValue(customer.healthGoal);
    await expect(await sales.patch(`/api/customers/${customer.id}`, { data: { segment: customer.segment, healthGoal: customer.healthGoal } })).toBeOK();
  } finally {
    if (id) await page.request.delete(`/api/tickets/${id}`);
    await sales.dispose(); await care.dispose();
  }
});

test("xuất đơn hàng đủ cột vàng và không lặp tổng thanh toán", async ({ page }) => {
  const response = await page.request.get("/api/reports/export?template=orders");
  expect(response.ok()).toBeTruthy();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await response.body()).buffer);
  const sheet = workbook.worksheets[0];
  const expected = ["Ngày", "Tháng", "Kênh bán", "Mã đơn hàng", "Tên khách", "Số điện thoại", "Tình trạng", "Sản phẩm", "Số lượng", "Tổng thanh toán", "Nhân viên phụ trách"];
  let headerRow = 0;
  sheet.eachRow((row, index) => { if (row.getCell(1).text === "Ngày") headerRow = index; });
  expect(headerRow).toBeGreaterThan(0);
  expect(expected.map((_, index) => sheet.getRow(headerRow).getCell(index + 1).text)).toEqual(expected);
  const charged = new Set();
  sheet.eachRow((row, index) => {
    if (index <= headerRow) return;
    expect(expected.map((_, column) => row.getCell(column + 1).text).join(" ")).not.toMatch(damaged);
    const code = row.getCell(4).text;
    if (code && row.getCell(10).value !== null && row.getCell(10).text !== "") {
      expect(charged.has(code), code).toBeFalsy(); charged.add(code);
    }
  });
  expect(charged.size).toBeGreaterThan(0);
});
