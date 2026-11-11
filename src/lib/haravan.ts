import { createHmac, timingSafeEqual } from "node:crypto";
import { getIntegrationConfig } from "./integration-config";

export async function verifyHaravanWebhook(
  rawBody: string,
  signature: string | null,
) {
  const secret = (await getIntegrationConfig()).haravanWebhookSecret;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function fetchHaravanOrders(updatedAtMin?: string) {
  const token = (await getIntegrationConfig()).haravanAccessToken;
  if (!token) throw new Error("HARAVAN_ACCESS_TOKEN is not configured");
  const url = new URL("https://apis.haravan.com/com/orders.json");
  url.searchParams.set("limit", "50");
  if (updatedAtMin) url.searchParams.set("updated_at_min", updatedAtMin);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Haravan API returned ${response.status}`);
  return response.json() as Promise<{ orders?: unknown[] }>;
}

type HaravanCheck = {
  key: "shop" | "orders" | "customers" | "products";
  label: string;
  ok: boolean;
  status: number;
  message: string;
};

export async function testHaravanConnection() {
  const token = (await getIntegrationConfig()).haravanAccessToken;
  if (!token)
    throw new Error("Chưa có Token Haravan. Vui lòng lưu Token trước.");
  const resources = [
    ["shop", "Thông tin cửa hàng", "shop.json"],
    ["orders", "Đơn hàng", "orders.json?limit=1"],
    ["customers", "Khách hàng", "customers.json?limit=1"],
    ["products", "Sản phẩm", "products.json?limit=1"],
  ] as const;
  const checked = await Promise.all(
    resources.map(
      async ([key, label, path]): Promise<
        HaravanCheck & { data?: unknown }
      > => {
        try {
          const response = await fetch(`https://apis.haravan.com/com/${path}`, {
            headers: {
              authorization: `Bearer ${token}`,
              accept: "application/json",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          const data = await response.json().catch(() => null);
          return {
            key,
            label,
            ok: response.ok,
            status: response.status,
            message: response.ok
              ? "Đọc dữ liệu thành công"
              : response.status === 401
                ? "Token không hợp lệ hoặc đã bị thu hồi"
                : response.status === 403
                  ? "Token chưa được cấp quyền đọc mục này"
                  : `Haravan trả về lỗi ${response.status}`,
            data: key === "shop" && response.ok ? data : undefined,
          };
        } catch (error) {
          return {
            key,
            label,
            ok: false,
            status: 0,
            message:
              error instanceof Error
                ? error.message
                : "Không thể kết nối Haravan",
          };
        }
      },
    ),
  );
  const shopPayload = checked.find((item) => item.key === "shop")?.data as
    | { shop?: { name?: string; domain?: string; myharavan_domain?: string } }
    | undefined;
  const shop = shopPayload?.shop;
  return {
    ok: checked.every((item) => item.ok),
    shopName: shop?.name || "",
    shopDomain: shop?.myharavan_domain || shop?.domain || "",
    checks: checked.map((item) => ({
      key: item.key,
      label: item.label,
      ok: item.ok,
      status: item.status,
      message: item.message,
    })),
  };
}
