"use client";
import { MessageSquarePlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { SalesOrder } from "@/lib/types";

export function CreateActivityButton({
  customerId,
  orders,
}: {
  customerId: string;
  orders: SalesOrder[];
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const order = orders.find((item) => item.id === form.get("orderId"));
    const body = {
      customerId,
      ...Object.fromEntries(form.entries()),
      purchaseChannel: order?.channel || form.get("purchaseChannel"),
      adverseReaction: form.get("adverseReaction") === "on",
    };
    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Không thể lưu nhật ký");
      setLoading(false);
      return;
    }
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <button className="primary-button" onClick={() => setOpen(true)}>
        <MessageSquarePlus size={16} />
        Ghi nhận chăm sóc
      </button>
      {open && (
        <Modal
          title="Nhật ký chăm sóc"
          description="Liên kết lần chăm sóc với đơn hàng và thời điểm tái mua."
          onClose={() => setOpen(false)}
        >
          <form className="entity-form" onSubmit={submit}>
            <div className="form-grid">
              <label className="full">
                Đơn hàng liên quan
                <select name="orderId">
                  <option value="">Không gắn đơn hàng</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.code} · {order.orderDate} · {order.channel}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kênh chăm sóc
                <select name="channel">
                  <option>Gọi điện</option>
                  <option>Zalo</option>
                  <option>Facebook</option>
                  <option>SMS</option>
                  <option>Trực tiếp</option>
                </select>
              </label>
              <label>
                Nhân viên
                <select name="employee">
                  <option>Vân Anh</option>
                  <option>Trâm</option>
                  <option>Linh</option>
                  <option>Ly</option>
                  <option>Phước An</option>
                </select>
              </label>
              <label className="full">
                Mục đích
                <select name="purpose">
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
                <input name="healthGoal" />
              </label>
              <label className="full">
                Ghi chú
                <textarea name="note" rows={3} />
              </label>
              <label className="check-label full">
                <input name="adverseReaction" type="checkbox" /> Có phản ứng bất
                thường cần chú ý
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button className="primary-button" disabled={loading}>
                {loading ? "Đang lưu..." : "Lưu nhật ký"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
