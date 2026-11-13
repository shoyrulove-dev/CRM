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
  await expect(page.locator(".login-pagination")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sửa tài khoản/ }).first()).toHaveAttribute("title", "Sửa tài khoản");
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
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/$/);
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

test("cấu hình Haravan chỉ yêu cầu một Token", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: /Haravan/ }).click();
  await expect(page.getByLabel(/Token Private App/)).toBeVisible();
  await expect(
    page.getByText("Cửa hàng nhận diện tự động", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nhận thông báo thay đổi từ Haravan (tùy chọn)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu Token" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đồng bộ dữ liệu ngay" }),
  ).toBeVisible();
});

test("người dùng có thể mở biểu mẫu đổi mật khẩu cá nhân", async ({ page }) => {
  await page.locator(".user-chip").click();
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByRole("heading", { name: "Đổi mật khẩu" })).toBeVisible();
  await expect(page.getByLabel("Mật khẩu hiện tại")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nhập lại mật khẩu mới")).toBeVisible();
});

test("quản trị có biểu mẫu đặt lại mật khẩu cho tài khoản", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByLabel(/Đặt lại mật khẩu/).first().click();
  await expect(page.getByRole("heading", { name: "Đặt lại mật khẩu" })).toBeVisible();
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nhập lại mật khẩu mới")).toBeVisible();
});

test("lịch chăm sóc và phiếu yêu cầu chọn được đơn, sản phẩm", async ({ page }) => {
  await page.goto("/care");
  await page.getByRole("button", { name: "Tạo lịch chăm sóc" }).click();
  await expect(page.getByLabel("Đơn hàng", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sản phẩm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hủy" }).click();

  await page.goto("/tickets");
  await page.getByRole("button", { name: "Tạo phiếu yêu cầu" }).click();
  await expect(page.getByLabel("Sản phẩm thu/đổi")).toBeVisible();
  await expect(page.getByLabel("Sản phẩm đổi sang")).toBeVisible();
});

test("báo cáo có nhiều mẫu Excel và phiếu có bộ lọc hướng xử lý", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByLabel("Mẫu báo cáo")).toHaveValue("detail");
  await expect(page.getByLabel("Mẫu báo cáo").locator("option")).toHaveCount(4);
  await page.goto("/tickets");
  await expect(page.locator('select[name="resolution"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Xuất Excel" })).toBeVisible();
});
