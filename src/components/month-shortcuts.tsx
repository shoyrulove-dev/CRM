"use client";
import type { MouseEvent } from "react";
export function MonthShortcuts({ resetPath }: { resetPath: string }) {
  function choose(event: MouseEvent<HTMLButtonElement>, offset: number) {
    const form = event.currentTarget.form;
    if (!form) return;
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const year = Number(parts.find(p => p.type === "year")?.value), month = Number(parts.find(p => p.type === "month")?.value);
    const value = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
    for (const name of ["from", "to"]) {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (field) field.value = field.type === "date" ? `${value}-${name === "from" ? "01" : String(new Date(Date.UTC(year, month + offset, 0)).getUTCDate()).padStart(2, "0")}` : value;
    }
    const day = form.elements.namedItem("date") as HTMLInputElement | null;
    if (day) day.value = "";
    form.requestSubmit();
  }
  return <span className="month-shortcuts"><button type="button" className="secondary-button" onClick={event => choose(event, 0)}>Tháng này</button><button type="button" className="secondary-button" onClick={event => choose(event, -1)}>Tháng trước</button><a className="secondary-button" href={resetPath}>Xóa lọc</a></span>;
}
