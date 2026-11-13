"use client";
import { useState } from "react";
import { Modal } from "./modal";
import type { ServiceTicket } from "@/lib/types";

export function TicketDetailButton({ ticket, phone }: { ticket: ServiceTicket; phone: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="text-button" onClick={() => setOpen(true)}>{ticket.id}</button>{open && <Modal title={`Phiếu ${ticket.id}`} description={ticket.title} onClose={() => setOpen(false)}>
    <dl className="detail-list">
      <div><dt>Khách hàng</dt><dd>{ticket.customer} · {phone || "Chưa có số"}</dd></div>
      <div><dt>Trạng thái</dt><dd>{ticket.status}</dd></div><div><dt>Ưu tiên</dt><dd>{ticket.priority}</dd></div>
      <div><dt>Phụ trách</dt><dd>{ticket.owner}</dd></div><div><dt>Hướng xử lý</dt><dd>{ticket.resolution || "Chưa chọn"}</dd></div>
      <div><dt>Đơn hàng</dt><dd>{ticket.orderCode || "Không gắn đơn"}</dd></div>
      <div><dt>Sản phẩm thu/đổi</dt><dd>{ticket.returnProductName ? `${ticket.returnProductName} · SL ${ticket.returnQuantity || 1}` : "Không có"}</dd></div>
      <div><dt>Sản phẩm đổi sang</dt><dd>{ticket.exchangeProductName ? `${ticket.exchangeProductName} · SL ${ticket.exchangeQuantity || 1}` : "Không có"}</dd></div>
      <div><dt>Mô tả</dt><dd>{ticket.description || "Không có ghi chú"}</dd></div>
      <div><dt>Ngày tạo</dt><dd>{new Date(ticket.createdAt).toLocaleString("vi-VN")}</dd></div>
    </dl><footer><button className="primary-button" onClick={() => setOpen(false)}>Đóng</button></footer>
  </Modal>}</>;
}
