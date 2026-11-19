"use client";
import { useEffect, useState } from "react";
import type { SalesOrder } from "@/lib/types";
export type FormOrder = Pick<SalesOrder, "id" | "code" | "customerId" | "orderDate" | "products">;
export function useCustomerOrders(initialOrders: FormOrder[], customerId: string, kind: "care" | "tickets", enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ customerId: string; attempt: number; orders: FormOrder[]; error: string } | null>(null);
  useEffect(() => {
    if (!enabled || !customerId) return;
    const controller = new AbortController(); let active = true;
    fetch(`/api/form-options?kind=${kind}&customerId=${encodeURIComponent(customerId)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    }).then(async response => {
      if (!response.ok) throw new Error("Không tải được đơn hàng của khách. Vui lòng thử lại.");
      return response.json();
    }).then(json => { if (active) setState({ customerId, attempt, orders: json.orders || [], error: "" }); })
      .catch(() => { if (active) setState({ customerId, attempt, orders: [], error: "Không tải được đơn hàng. Vui lòng thử lại trước khi lưu." }); });
    return () => { active = false; controller.abort(); };
  }, [customerId, kind, enabled, attempt]);
  const resolved = state?.customerId === customerId && state.attempt === attempt;
  return {
    orders: enabled ? resolved ? state.orders : [] : initialOrders,
    loading: enabled && !!customerId && !resolved,
    error: enabled && resolved ? state.error : "",
    retry: () => setAttempt(value => value + 1),
  };
}
