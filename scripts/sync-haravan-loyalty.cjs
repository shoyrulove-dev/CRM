// Use the deployed authenticated route; never print secrets or customer payloads.
const all = process.argv.includes('--all');
async function main() {
  let failures = 0;
  const base = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) throw new Error('APP_URL/CRON_SECRET chưa được cấu hình.');
  const url = new URL('/api/internal/haravan-loyalty-sync', base);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Chỉ gửi thông tin xác thực qua HTTPS hoặc localhost.');
  for (let batch = 1; batch <= 200; batch++) {
    const response = await fetch(url, { method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      redirect: 'error', signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Route Loyalty trả HTTP ${response.status}; kiểm tra bản triển khai và xác thực.`);
    const { data } = await response.json();
    if (!data || typeof data.due !== 'number') throw new Error('Phản hồi route Loyalty không đúng hợp đồng.');
    console.log(JSON.stringify({ batch, status: data.status, updated: data.updated,
      failed: data.failed, total: data.total, missing: data.missing, due: data.due, busy: data.busy, halted: data.halted }));
    if (data.busy) {
      if (!all) return;
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    failures += data.failed;
    if (data.halted) throw new Error('Dừng do lỗi xác thực/quyền hoặc giới hạn tốc độ. Xem trạng thái trong Cài đặt.');
    if (!all || data.due === 0) {
      if (failures) { console.error(`Có ${failures} lượt đọc lỗi; dữ liệu cũ được giữ nguyên và sẽ thử lại.`); process.exitCode = 1; }
      return;
    }
  }
  throw new Error('Đạt giới hạn 200 lô; chạy lại để tiếp tục.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
