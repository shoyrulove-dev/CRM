"use client";
import { FormEvent, useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { PermissionGroup, PermissionKey } from "@/lib/types";
const choices: [PermissionKey, string][] = [
  ["customers", "Khách hàng"],
  ["care", "Lịch chăm sóc"],
  ["tickets", "Phiếu yêu cầu"],
  ["reports", "Báo cáo"],
];
export function GroupManager({ initial }: { initial: PermissionGroup[] }) {
  const [open, setOpen] = useState(false),
    router = useRouter();
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      r = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          permissions: f.getAll("permissions"),
        }),
      });
    if (r.ok) {
      setOpen(false);
      router.refresh();
    } else alert((await r.json()).error);
  }
  async function remove(id: string) {
    if (!confirm("Xóa nhóm quyền này?")) return;
    const r = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else alert((await r.json()).error);
  }
  return (
    <section className="group-section">
      <div className="section-title">
        <div>
          <h2>Nhóm quyền tùy chỉnh</h2>
          <p>Tạo nhóm và chọn những khu vực nhóm được sử dụng.</p>
        </div>
        <button className="secondary-button" onClick={() => setOpen(true)}>
          <Plus />
          Tạo nhóm
        </button>
      </div>
      <div className="group-list">
        {initial.map((g) => (
          <article className="panel" key={g.id}>
            <span>
              <ShieldCheck />
            </span>
            <div>
              <b>{g.name}</b>
              <small>
                {g.permissions
                  .map((x) => choices.find((c) => c[0] === x)?.[1])
                  .join(" · ") || "Chưa có quyền"}
              </small>
            </div>
            <button onClick={() => remove(g.id)}>
              <Trash2 />
            </button>
          </article>
        ))}
        {!initial.length && <p>Chưa có nhóm tùy chỉnh.</p>}
      </div>
      {open && (
        <Modal
          title="Tạo nhóm quyền"
          description="Chọn các khu vực mà thành viên của nhóm được sử dụng."
          onClose={() => setOpen(false)}
        >
          <form className="entity-form" onSubmit={create}>
            <div className="form-grid">
              <label className="full">
                Tên nhóm
                <input name="name" required />
              </label>
              <div className="permission-grid full">
                {choices.map(([key, text]) => (
                  <label key={key}>
                    <input type="checkbox" name="permissions" value={key} />
                    {text}
                  </label>
                ))}
              </div>
            </div>
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button className="primary-button">Tạo nhóm</button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
