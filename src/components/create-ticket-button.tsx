"use client";
import { Plus, TicketPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { Customer, ProductOption, SalesOrder } from "@/lib/types";
import { useCustomerOrders } from "./use-customer-orders";
type Employee = { id: string; name: string };
export function CreateTicketButton({ customers, employees = [], customerId, orderCode, orders = [], products = [], compact = false, initialOpen = false, loadOrdersOnDemand = false }: { customers: Customer[]; employees?: Employee[]; customerId?: string; orderCode?: string; orders?: SalesOrder[]; products?: ProductOption[]; compact?: boolean; initialOpen?: boolean; loadOrdersOnDemand?: boolean }) {
  const [open, setOpen] = useState(initialOpen), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(customerId || ""), [order, setOrder] = useState(orderCode || "");
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase("vi");
  const digits = /^[\d+ .()-]+$/.test(needle) ? needle.replace(/\D/g, "").replace(/^84(?=\d{9}$)/, "0") : "";
  const matches = needle ? customers.filter(item => `${item.name} ${item.id} ${item.phone}`.toLocaleLowerCase("vi").includes(needle) ||
    (digits && (item.phone || "").replace(/\D/g, "").replace(/^84(?=\d{9}$)/, "0").includes(digits))).slice(0, 7) : [];
  const chosen = customers.find(item => item.id === customer);
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = `nichiei-ticket-draft-${customerId || "all"}`;
  useEffect(() => {
    if (!open || !formRef.current) return;
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null") as Record<string, string> | null;
      if (!draft) return;
      for (const [name, value] of Object.entries(draft).filter(([name]) => ["title", "description"].includes(name))) {
        const field = formRef.current?.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
      }
    } catch { /* A damaged browser draft must not block the form. */ }
  }, [open, draftKey, customerId, orderCode]);
  const router = useRouter();
  const orderData = useCustomerOrders(orders, customer, "tickets", loadOrdersOnDemand && open);
  const available = useMemo(() => orderData.orders.filter((item) => item.customerId === customer), [orderData.orders, customer]);
  const current = available.find((item) => item.code === order);
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!customer || orderData.loading || orderData.error) {
      event.preventDefault();
      if (!customer) setError("Vui lòng tìm và chọn khách hàng trước khi lưu.");
      return;
    }
    event.preventDefault(); setLoading(true); setError(""); const form = new FormData(event.currentTarget);
    const selected = customers.find((item) => item.id === customer);
    const returned = current?.products.find((item) => item.sku === form.get("returnProductSku"));
    const exchanged = products.find((item) => item.sku === form.get("exchangeProductSku"));
    try {
    const response = await fetch("/api/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      customerId: selected?.id, title: form.get("title"), description: form.get("description"), priority: form.get("priority"), owner: form.get("owner"), resolution: form.get("resolution"), orderCode: order,
      returnProductSku: returned?.sku || "", returnProductName: returned?.name || "", returnQuantity: form.get("returnQuantity"), exchangeProductSku: exchanged?.sku || "", exchangeProductName: exchanged?.name || "", exchangeQuantity: form.get("exchangeQuantity"),
    }) });
    const json = await response.json(); if (!response.ok) { setError(response.status === 401 ? "Phiên đăng nhập đã hết hạn. Nội dung đã được giữ lại; hãy đăng nhập rồi mở lại biểu mẫu." : json.error || "Không thể tạo phiếu"); setLoading(false); return; }
    sessionStorage.removeItem(draftKey);
    setOpen(false); setLoading(false); router.refresh();
    } catch {
      setError("Kết nối bị gián đoạn. Nội dung vẫn còn trên màn hình, vui lòng thử lưu lại.");
      setLoading(false);
    }
  }
  return <><button className={compact ? "order-action" : "primary-button"} onClick={() => setOpen(true)}>{compact ? <TicketPlus size={14} /> : <Plus size={18} />}Tạo phiếu yêu cầu</button>
    {open && <Modal title={orderCode ? `Tạo phiếu từ đơn ${orderCode}` : "Tạo phiếu yêu cầu"} description="Theo dõi phản ánh, đổi trả hoặc yêu cầu phối hợp." onClose={() => setOpen(false)}><form ref={formRef} className="entity-form" onSubmit={submit} onChange={(event) => {
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form).entries());
      sessionStorage.setItem(draftKey, JSON.stringify({ ...values, orderCode: order }));
    }}><div className="form-grid">
      <div className="full">
        {chosen ? <p>Khách hàng đã chọn <strong>{chosen.name} · {chosen.phone}</strong>{!customerId && <> <button type="button" className="secondary-button" onClick={() => { setCustomer(""); setOrder(""); setSearch(""); }}>Chọn khách khác</button></>}</p>
          : <><label>Tìm khách hàng<input type="search" placeholder="Nhập SĐT, tên hoặc mã khách" value={search} onChange={e => setSearch(e.target.value)} /></label>
            {needle && (matches.length ? <ul className="ticket-customer-results">{matches.map(item => <li key={item.id}><button type="button" className="secondary-button" onClick={() => { setCustomer(item.id); setOrder(""); setError(""); }}>{item.name} · {item.phone} · {item.id}</button></li>)}</ul> : <p role="status">Không tìm thấy khách phù hợp.</p>)}
          </>}
      </div>
      <label className="full">Đơn hàng<select value={order} onChange={(e) => setOrder(e.target.value)} disabled={Boolean(orderCode) || orderData.loading}><option value="">{orderData.loading ? "Đang tải đơn của khách..." : "Không gắn đơn hàng"}</option>{available.map((item) => <option key={item.id} value={item.code}>{item.code} · {item.orderDate}</option>)}</select></label>
      <label className="full">Nội dung<input name="title" required defaultValue={orderCode ? `Yêu cầu liên quan đơn ${orderCode}` : ""} placeholder="Tóm tắt yêu cầu" /></label>
      <label className="full">Mô tả<textarea name="description" rows={3} /></label>
      <label>Ưu tiên<select name="priority"><option>Bình thường</option><option>Cao</option><option>Khẩn cấp</option></select></label><label>Phụ trách<select key={customer} name="owner" defaultValue={customers.find((item) => item.id === customer)?.owner || employees[0]?.name || ""}>{employees.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <label className="full">Hướng xử lý<select name="resolution" defaultValue="Điều chỉnh cách dùng"><option>Thu hàng - Hoàn tiền</option><option>Đổi hàng</option><option>Điều chỉnh cách dùng</option><option>Khác</option></select></label>
      <label>Sản phẩm thu/đổi<select name="returnProductSku" disabled={!current}><option value="">Không chọn</option>{current?.products.map((item, i) => <option key={`${item.sku}-${i}`} value={item.sku}>{item.name}</option>)}</select></label><label>Số lượng<input name="returnQuantity" type="number" min="1" defaultValue="1" /></label>
      <label>Sản phẩm đổi sang<select name="exchangeProductSku"><option value="">Không chọn</option>{products.map((item) => <option key={item.sku} value={item.sku}>{item.name}{item.sku ? ` · ${item.sku}` : ""}</option>)}</select></label><label>Số lượng đổi<input name="exchangeQuantity" type="number" min="1" defaultValue="1" /></label>
    </div>{orderData.error && <p className="form-error">{orderData.error} <button type="button" className="secondary-button" onClick={orderData.retry}>Tải lại đơn</button></p>}{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button><button className="primary-button" disabled={loading || orderData.loading || !!orderData.error}>{loading ? "Đang lưu..." : "Tạo phiếu"}</button></footer></form></Modal>}
  </>;
}
