"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RefreshLoyaltyButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""); const router = useRouter();
  return <div><button className="secondary-button" disabled={busy} onClick={async () => {
    setBusy(true); setMessage("");
    try { const r = await fetch(`/api/customers/${encodeURIComponent(id)}/loyalty`, { method: "POST" }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setMessage("Đã cập nhật hạng và điểm từ Haravan."); router.refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Chưa kết nối được. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }}>{busy ? "Đang cập nhật..." : "Cập nhật hạng/điểm"}</button>{message && <p role="status">{message}</p>}</div>;
}
