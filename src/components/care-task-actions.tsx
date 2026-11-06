"use client";
import { CalendarClock, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { CareTask } from "@/lib/types";
type Employee = { id: string; name: string };
const localInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
export function CareTaskActions({
  task,
  employees,
}: {
  task: CareTask;
  employees: Employee[];
}) {
  const [loading, setLoading] = useState(false),
    [open, setOpen] = useState(false),
    router = useRouter();
  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    const response = await fetch(`/api/care/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (response.ok) {
      setOpen(false);
      router.refresh();
    } else alert((await response.json()).error || "Không thể cập nhật lịch.");
  }
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await patch({
      purpose: form.get("purpose"),
      dueAt: new Date(String(form.get("dueAt"))).toISOString(),
      owner: form.get("owner"),
      channel: form.get("channel"),
    });
  }
  async function postpone(days: number) {
    const due = new Date(task.dueAt);
    due.setDate(due.getDate() + days);
    await patch({ dueAt: due.toISOString(), status: "due" });
  }
  async function remove() {
    if (!confirm("Xóa lịch chăm sóc này? Thao tác này không thể hoàn tác."))
      return;
    setLoading(true);
    const response = await fetch(`/api/care/${encodeURIComponent(task.id)}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (response.ok) router.refresh();
    else alert((await response.json()).error || "Không thể xóa lịch.");
  }
  return (
    <div className="care-actions">
      <button
        className="secondary-button"
        disabled={loading || task.status === "done"}
        onClick={() => patch({ status: "done" })}
      >
        <CheckCircle2 size={15} />
        {task.status === "done" ? "Đã hoàn thành" : "Hoàn thành"}
      </button>
      <button
        className="icon-action"
        title="Sửa lịch"
        onClick={() => setOpen(true)}
      >
        <Pencil size={15} />
      </button>
      {task.status !== "done" && (
        <button
          className="icon-action"
          title="Hoãn 1 ngày"
          onClick={() => postpone(1)}
        >
          <CalendarClock size={15} />
          <small>+1</small>
        </button>
      )}
      <button className="icon-action danger" title="Xóa lịch" onClick={remove}>
        <Trash2 size={15} />
      </button>
      {open && (
        <Modal
          title="Sửa lịch chăm sóc"
          description="Thay đổi nội dung, thời gian hoặc người phụ trách."
          onClose={() => setOpen(false)}
        >
          <form className="entity-form" onSubmit={edit}>
            <div className="form-grid">
              <label className="full">
                Nội dung
                <input name="purpose" defaultValue={task.purpose} required />
              </label>
              <label>
                Ngày giờ
                <input
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={localInput(task.dueAt)}
                  required
                />
              </label>
              <label>
                Phụ trách
                <select name="owner" defaultValue={task.owner}>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.name}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kênh
                <select name="channel" defaultValue={task.channel}>
                  <option>Gọi điện</option>
                  <option>Zalo</option>
                  <option>Facebook</option>
                  <option>SMS</option>
                  <option>Trực tiếp</option>
                </select>
              </label>
            </div>
            <div className="postpone-row">
              <span>Hoãn nhanh:</span>
              <button type="button" onClick={() => postpone(1)}>
                1 ngày
              </button>
              <button type="button" onClick={() => postpone(7)}>
                7 ngày
              </button>
              <button type="button" onClick={() => postpone(30)}>
                30 ngày
              </button>
            </div>
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button className="primary-button" disabled={loading}>
                {loading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
