"use client";
import { Plus, TicketPlus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { Customer, SalesOrder } from "@/lib/types";
type Employee = { id: string; name: string };
export function CreateTicketButton({ customers, employees = [], customerId, orderCode, orders = [], compact = false }: { customers: Customer[]; employees?: Employee[]; customerId?: string; orderCode?: string; orders?: SalesOrder[]; compact?: boolean }) {
  const [open, setOpen] = useState(false), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(customerId || customers[0]?.id || ""), [order, setOrder] = useState(orderCode || "");
  const router = useRouter();
  const available = useMemo(() => orders.filter((item) => item.customerId === customer), [orders, customer]);
  const current = available.find((item) => item.code === order);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); const form = new FormData(event.currentTarget);
    const selected = customers.find((item) => item.id === form.get("customerId"));
    const returned = current?.products.find((item) => item.sku === form.get("returnProductSku"));
    const exchanged = current?.products.find((item) => item.sku === form.get("exchangeProductSku"));
    const response = await fetch("/api/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      customerId: selected?.id, title: form.get("title"), description: form.get("description"), priority: form.get("priority"), owner: form.get("owner"), resolution: form.get("resolution"), orderCode: order,
      returnProductSku: returned?.sku || "", returnProductName: returned?.name || "", returnQuantity: form.get("returnQuantity"), exchangeProductSku: exchanged?.sku || "", exchangeProductName: exchanged?.name || "", exchangeQuantity: form.get("exchangeQuantity"),
    }) });
    const json = await response.json(); if (!response.ok) { setError(json.error || "Không thể tạo phiếu"); setLoading(false); return; }
    setOpen(false); setLoading(false); router.refresh();
  }
  return <><button className={compact ? "order-action" : "primary-button"} onClick={() => setOpen(true)}>{compact ? <TicketPlus size={14} /> : <Plus size={18} />}Tạo phiếu yêu cầu</button>
    {open && <Modal title={orderCode ? `Tạo phiếu từ đơn ${orderCode}` : "Tạo phiếu yêu cầu"} description="Theo dõi phản ánh, đổi trả hoặc yêu cầu phối hợp." onClose={() => setOpen(false)}><form className="entity-form" onSubmit={submit}><div className="form-grid">
      <label className="full">Khách hàng<select name="customerId" required value={customer} onChange={(e) => { setCustomer(e.target.value); setOrder(""); }} disabled={Boolean(customerId)}>{customers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}</select></label>
      <label className="full">Đơn hàng<select value={order} onChange={(e) => setOrder(e.target.value)} disabled={Boolean(orderCode)}><option value="">Không gắn đơn hàng</option>{available.map((item) => <option key={item.id} value={item.code}>{item.code} · {item.orderDate}</option>)}</select></label>
      <label className="full">Nội dung<input name="title" required defaultValue={orderCode ? `Yêu cầu liên quan đơn ${orderCode}` : ""} placeholder="Tóm tắt yêu cầu" /></label>
      <label className="full">Mô tả<textarea name="description" rows={3} /></label>
      <label>Ưu tiên<select name="priority"><option>Bình thường</option><option>Cao</option><option>Khẩn cấp</option></select></label><label>Phụ trách<select name="owner" defaultValue={employees[0]?.name || ""}>{employees.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <label className="full">Hướng xử lý<select name="resolution" defaultValue="Điều chỉnh cách dùng"><option>Thu hàng - Hoàn tiền</option><option>Đổi hàng</option><option>Điều chỉnh cách dùng</option><option>Khác</option></select></label>
      <label>Sản phẩm thu/đổi<select name="returnProductSku" disabled={!current}><option value="">Không chọn</option>{current?.products.map((item, i) => <option key={`${item.sku}-${i}`} value={item.sku}>{item.name}</option>)}</select></label><label>Số lượng<input name="returnQuantity" type="number" min="1" defaultValue="1" /></label>
      <label>Sản phẩm đổi sang<select name="exchangeProductSku" disabled={!current}><option value="">Không chọn</option>{current?.products.map((item, i) => <option key={`${item.sku}-${i}`} value={item.sku}>{item.name}</option>)}</select></label><label>Số lượng đổi<input name="exchangeQuantity" type="number" min="1" defaultValue="1" /></label>
    </div>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button><button className="primary-button" disabled={loading}>{loading ? "Đang lưu..." : "Tạo phiếu"}</button></footer></form></Modal>}
  </>;
}
