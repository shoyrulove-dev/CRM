"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateCareButton } from "./create-care-button";
import { CreateTicketButton } from "./create-ticket-button";
import type { Customer, SalesOrder, ProductOption } from "@/lib/types";

type Data = { customers: Customer[]; orders: SalesOrder[]; products: ProductOption[]; employees: { id: string; name: string }[] };
export function LazyCreateButton({ kind }: { kind: "care" | "tickets" }) {
  const [data, setData] = useState<Data | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/form-options?kind=${kind}`);
      if (!response.ok) throw new Error("Không tải được biểu mẫu. Vui lòng thử lại.");
      setData(await response.json());
    } catch (error) { setError(error instanceof Error ? error.message : "Kết nối gián đoạn."); }
    finally { setLoading(false); }
  }
  if (data) return kind === "care" ? <CreateCareButton {...data} initialOpen /> : <CreateTicketButton {...data} initialOpen />;
  return <><button className="primary-button" onClick={load} disabled={loading}><Plus size={18} />{loading ? "Đang mở..." : kind === "care" ? "Tạo lịch chăm sóc" : "Tạo phiếu yêu cầu"}</button>{error && <span className="form-error">{error}</span>}</>;
}
