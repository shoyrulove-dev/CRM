"use client";
import { Download } from "lucide-react";
import { useState } from "react";
import { Modal } from "./modal";

const fields = [
  ["id", "Mã khách"],
  ["name", "Tên khách"],
  ["phone", "Số điện thoại"],
  ["birthDate", "Ngày sinh"],
  ["owner", "Nhân viên"],
  ["segment", "Nhóm"],
  ["healthGoal", "Mục tiêu sức khỏe"],
  ["orders", "Số đơn"],
  ["revenue", "Doanh thu"],
  ["lastOrder", "Đơn gần nhất"],
  ["lastCare", "Lần chăm gần nhất"],
  ["nextCare", "Lịch chăm sóc"],
] as const;

export function ExportCustomersButton({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setOpen(true)}
      >
        <Download size={17} />
        Xuất Excel
      </button>
      {open && (
        <Modal
          title="Chọn dữ liệu cần xuất"
          description="File Excel áp dụng đúng bộ lọc đang hiển thị."
          onClose={() => setOpen(false)}
        >
          <form
            className="entity-form"
            action="/api/customers/export"
            method="get"
          >
            {Object.entries(query).map(([key, value]) =>
              value ? (
                <input key={key} type="hidden" name={key} value={value} />
              ) : null,
            )}
            <div className="permission-grid full">
              {fields.map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name="fields"
                    value={key}
                    defaultChecked
                  />
                  {label}
                </label>
              ))}
            </div>
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button className="primary-button">
                <Download size={17} />
                Tải file Excel
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
