# Nichiéi CRM

MVP hệ thống chăm sóc khách hàng Nichiéi, lấy Haravan làm nguồn dữ liệu bán hàng.

## Chạy local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Ứng dụng chạy được với dữ liệu demo khi chưa có `MONGODB_URI`.

## Biến môi trường

Xem `.env.example`. Không commit token hoặc connection string vào repository.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run build
```

Health check: `GET /api/health`.

Scheduler: `POST /api/internal/scheduler` với header `Authorization: Bearer <CRON_SECRET>`.

## Triển khai

- Test: GitHub → Vercel, MongoDB Atlas, Cloudflare Cron.
- Production: Docker trên VPS. Dockerfile đã dùng Next.js standalone output.

## Trạng thái

Giao diện MVP hiện dùng dữ liệu demo. Tích hợp MongoDB, đăng nhập/phân quyền và Haravan API/webhook là các giai đoạn tiếp theo.
