import type { CareStatus } from "@/lib/types";

export function StatusPill({ status }: { status: CareStatus }) {
  const labels = {
    due: "Sắp đến hạn",
    overdue: "Quá hạn",
    done: "Đã hoàn thành",
  };
  return (
    <span className={`status status-${status}`}>
      <i />
      {labels[status]}
    </span>
  );
}
