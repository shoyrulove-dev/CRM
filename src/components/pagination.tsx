import Link from "next/link";

export function pageNumber(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000000) : 1;
}

export function Pagination({ page, size, total, pathname, params }: {
  page: number; size: number; total: number; pathname: string; params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  function href(next: number) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "") as [string, string][]);
    query.set("page", String(next));
    return `${pathname}?${query}`;
  }
  return <nav className="list-pagination" aria-label="Phân trang danh sách">
    <span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} / ${total} kết quả` : "Chưa có kết quả"}</span>
    <div>{page > 1 && <Link href={href(page - 1)} rel="prev">Trước</Link>}<span>Trang {page}/{pages}</span>{page < pages && <Link href={href(page + 1)} rel="next">Sau</Link>}</div>
  </nav>;
}
