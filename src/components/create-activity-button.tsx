"use client";
import { MessageSquarePlus } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { SalesOrder } from "@/lib/types";
import { healthGoals } from "@/lib/customer-options";
import { useCustomerOrders, type FormOrder } from "./use-customer-orders";

export function CreateActivityButton({
  customerId,
  orders,
  task,
  employees,
}: {
  customerId: string;
  orders: SalesOrder[];
  task?: { id: string; orderId?: string; channel: string; purpose: string; owner: string; status: string };
  employees?: string[];
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const requestId = useRef("");
  const orderData = useCustomerOrders(orders, customerId, "care", Boolean(task && open));
  const availableOrders = orderData.orders as (FormOrder & { channel?: string })[];
  function openForm() {
    requestId.current = task ? crypto.randomUUID() : "";
    setSaved(false);
    setError("");
    setOpen(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || (!saved && (orderData.loading || orderData.error))) return;
    const complete = saved || (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "complete";
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const order = availableOrders.find((item) => item.id === form.get("orderId"));
    const body = {
      customerId,
      ...Object.fromEntries(form.entries()),
      ...(task ? { taskId: task.id, requestId: requestId.current } : {}),
      purchaseChannel: order?.channel || form.get("purchaseChannel"),
      adverseReaction: form.get("adverseReaction") === "on",
    };
    try {
    if (!saved) {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Không thể lưu nhật ký");
        return;
      }
      if (complete) setSaved(true);
    }
    if (complete && task) {
      const response = await fetch(`/api/care/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }).catch(() => null);
      if (!response?.ok) {
        setError("Nhật ký đã lưu. Chưa xác nhận được lịch đã hoàn thành. Bạn có thể thử lại bước hoàn thành.");
        router.refresh();
        return;
      }
    }
    setOpen(false);
    router.refresh();
    } catch {
      setError("Kết nối bị gián đoạn. Nội dung vẫn được giữ trên biểu mẫu; vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <button type="button" className={task ? "secondary-button" : "primary-button"} onClick={openForm}>
        <MessageSquarePlus size={16} />
        Ghi nhận chăm sóc
      </button>
      {open && (
        <Modal
          title="Nhật ký chăm sóc"
          description="Liên kết lần chăm sóc với đơn hàng và thời điểm tái mua."
          onClose={() => { if (!loading) setOpen(false); }}
        >
          <form className="entity-form" onSubmit={submit}>
            {!saved && <div className="form-grid">
              <label className="full">
                Đơn hàng liên quan
                <select name="orderId" key={orderData.loading ? "loading" : "ready"} defaultValue={task?.orderId}>
                  <option value="">Không gắn đơn hàng</option>
                  {availableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.code} · {order.orderDate}{order.channel ? ` · ${order.channel}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kênh chăm sóc
                <select name="channel" defaultValue={task?.channel}>
                  <option>Gọi điện</option>
                  <option>Zalo</option>
                  <option>Facebook</option>
                  <option>SMS</option>
                  <option>Trực tiếp</option>
                </select>
              </label>
              <label>
                Nhân viên
                <select name="employee" defaultValue={task?.owner}>
                  {(employees || ["Vân Anh", "Trâm", "Linh", "Ly", "Phước An"]).map(name => <option key={name}>{name}</option>)}
                </select>
              </label>
              <label className="full">
                Mục đích
                <select name="purpose" defaultValue={task?.purpose}>
                  {task?.purpose && !["Hướng dẫn sử dụng", "Hỏi thăm cảm nhận", "Nhắc tái mua", "Chăm sóc khách trung thành", "Xử lý phản ánh", "Gửi mẹo vặt, tương tác lại"].includes(task.purpose) && <option>{task.purpose}</option>}
                  <option>Hướng dẫn sử dụng</option>
                  <option>Hỏi thăm cảm nhận</option>
                  <option>Nhắc tái mua</option>
                  <option>Chăm sóc khách trung thành</option>
                  <option>Xử lý phản ánh</option>
                  <option>Gửi mẹo vặt, tương tác lại</option>
                </select>
              </label>
              <label>
                Liên lạc
                <select name="contactStatus">
                  <option>Liên lạc được</option>
                  <option>Không nghe máy</option>
                  <option>Không phản hồi tin nhắn</option>
                  <option>Thuê bao / Sai số</option>
                  <option>Hẹn gọi lại</option>
                </select>
              </label>
              <label>
                Kết quả
                <select name="result">
                  <option>Đang dùng - hài lòng</option>
                  <option>Đang dùng - chưa thấy hiệu quả</option>
                  <option>Mua lại - cùng sản phẩm</option>
                  <option>Mua lại - khác sản phẩm</option>
                  <option>Hẹn mua</option>
                  <option>Ngưng dùng</option>
                  <option>Chưa xác định</option>
                </select>
              </label>
              <label>
                Lý do chưa mua
                <select name="noPurchaseReason">
                  <option value="">Không áp dụng</option>
                  <option>Chưa dùng hết</option>
                  <option>Giá cao</option>
                  <option>Chưa thấy hiệu quả</option>
                  <option>Sợ lừa đảo</option>
                  <option>Mua qua đại lý / nơi khác</option>
                  <option>Người dùng tạm ngưng</option>
                  <option>Phản ứng không mong muốn</option>
                  <option>Khác</option>
                </select>
              </label>
              <label>
                Hài lòng (1–5)
                <select name="satisfaction">
                  <option value="">Chưa đánh giá</option>
                  {[1, 2, 3, 4, 5].map((number) => (
                    <option key={number}>{number}</option>
                  ))}
                </select>
              </label>
              <label>
                Ngày dự kiến hết liệu trình
                <input name="productEndDate" type="date" />
              </label>
              <label>
                Mục tiêu sức khỏe
                <select name="healthGoal"><option value="">Chưa ghi nhận</option>{healthGoals.map(value => <option key={value}>{value}</option>)}</select>
              </label>
              <label className="full">
                Ghi chú
                <textarea name="note" rows={3} />
              </label>
              <label className="check-label full">
                <input name="adverseReaction" type="checkbox" /> Có phản ứng bất
                thường cần chú ý
              </label>
            </div>}
            {!saved && orderData.error && <p className="form-error">{orderData.error} <button type="button" className="secondary-button" onClick={orderData.retry}>Tải lại đơn</button></p>}
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button
                type="button"
                className="secondary-button"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              {!saved && <button className="primary-button" disabled={loading || orderData.loading || !!orderData.error}>
                {loading ? "Đang lưu..." : "Lưu nhật ký"}
              </button>}
              {task && task.status !== "done" && <button className="secondary-button" value="complete" disabled={loading || (!saved && (orderData.loading || !!orderData.error))}>
                {saved ? "Thử hoàn thành lại" : "Lưu và hoàn thành lịch"}
              </button>}
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
