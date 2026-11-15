import { test, expect } from "@playwright/test";

test("modern workspace navigation and accessible drawer", async ({ page, isMobile }) => {
  await page.request.post("/api/auth/login", { data: { email: "admin@nichiei.vn", password: "Nichiei@2026" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tổng quan công việc" })).toBeVisible();
  if (!isMobile) {
    await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
    await expect(page.locator(".app-frame")).toHaveClass(/nav-collapsed/);
    await page.getByRole("button", { name: "Mở rộng thanh bên" }).click();
  } else {
    await page.getByRole("button", { name: "Mở menu" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/sidebar-open/);
    await page.locator(".sidebar").getByRole("link", { name: "Khách hàng", exact: true }).click();
  }
  await page.goto("/customers");
  await page.getByRole("button", { name: "Thêm khách hàng", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("forgot password page and invalid token are safe", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page.getByLabel("Email tài khoản")).toBeVisible();
  await page.goto(`/reset-password#${"a".repeat(64)}`);
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
  const response = await page.request.post("/api/auth/password-reset", { data: { token: "a".repeat(64), password: "InvalidReset!2026" } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("Liên kết");
  expect((await page.request.post("/api/email-settings", { data: { action: "save" } })).status()).toBe(401);
});

test("new accounts get a temporary password and must change it", async ({ playwright, baseURL }) => {
  const admin = await playwright.request.newContext({ baseURL });
  const employee = await playwright.request.newContext({ baseURL });
  await admin.post("/api/auth/login", { data: { email: "admin@nichiei.vn", password: "Nichiei@2026" } });
  let id = "";
  try {
    const email = `crm-ui-check-${Date.now()}@example.com`;
    const created = await admin.post("/api/users", { data: { name: "Kiểm thử giao diện", email, role: "sales" } });
    expect(created.status()).toBe(201);
    const data = await created.json(); id = data.data.id;
    expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(data.data.passwordHash).toBeUndefined();
    const login = await employee.post("/api/auth/login", { data: { email, password: data.temporaryPassword } });
    expect((await login.json()).user.mustChangePassword).toBe(true);
    expect((await employee.get("/api/customers")).status()).toBe(403);
    expect((await employee.post("/api/auth/change-password", { data: { currentPassword: data.temporaryPassword, newPassword: "PersonalPassword!2026" } })).ok()).toBeTruthy();
    expect((await employee.get("/api/customers")).ok()).toBeTruthy();
    expect((await admin.patch(`/api/users/${id}`, { data: { password: "ReplacementTemp!2026" } })).ok()).toBeTruthy();
    const stale = await employee.get("/api/customers");
    expect([401, 403]).toContain(stale.status());
    const again = await employee.post("/api/auth/login", { data: { email, password: "ReplacementTemp!2026" } });
    expect((await again.json()).user.mustChangePassword).toBe(true);
    const list = await (await admin.get("/api/users")).json();
    expect(JSON.stringify(list)).not.toContain("resetTokenHash");
    expect(JSON.stringify(list)).not.toContain("passwordHash");
  } finally {
    if (id) await admin.delete(`/api/users/${id}`);
    await admin.dispose(); await employee.dispose();
  }
});
