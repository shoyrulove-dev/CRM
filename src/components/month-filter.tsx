export function MonthFilter({ name, value, label }: { name: string; value?: string; label: string }) {
  const year = new Date().getFullYear();
  const months = Array.from({ length: (year - 2000 + 2) * 12 }, (_, index) => {
    const y = year + 1 - Math.floor(index / 12), m = 12 - index % 12;
    return `${y}-${String(m).padStart(2, "0")}`;
  });
  if (value && /^\d{4}-\d{2}$/.test(value) && !months.includes(value)) months.push(value);
  return <label className="month-filter">{label}<select className="ghost-select" name={name} defaultValue={value || ""} aria-label={label}>
    <option value="">Tất cả tháng</option>
    {months.map(month => <option key={month} value={month}>Tháng {Number(month.slice(5))}/{month.slice(0, 4)}</option>)}
  </select></label>;
}
