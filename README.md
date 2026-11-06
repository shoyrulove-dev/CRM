# Nichiei CRM

Hệ thống quản lý khách hàng và chăm sóc sau bán hàng của Nichiei.

## Chức năng chính

- Hồ sơ khách hàng và lịch sử mua hàng.
- Lịch chăm sóc một lần hoặc định kỳ.
- Nhật ký liên hệ, mức độ hài lòng và phản ứng bất thường.
- Nhắc tái mua theo ngày dự kiến hết liệu trình.
- Phiếu yêu cầu, phản ánh và theo dõi trạng thái xử lý.
- Báo cáo theo nhân viên, thời gian, kênh chăm sóc và kết quả.
- Xuất danh sách khách hàng và báo cáo ra tệp mở bằng Excel.

Haravan, Zalo và Facebook là các kết nối tùy chọn, sẽ thiết lập sau khi có tài khoản và quyền truy cập tương ứng.

## Chạy trên máy cá nhân

```bash
npm install
copy .env.example .env.local
npm run dev
```

## Kiểm tra trước khi bàn giao

```bash
npm run typecheck
npm run lint
npm run build
```

## Chuyển sang VPS

Source đã có Dockerfile. MongoDB có thể chạy cùng VPS bằng Docker Compose hoặc dùng dịch vụ bên ngoài. Không mở cổng MongoDB ra Internet.

## Sao lưu Cloudflare R2

Tệp `scripts/backup-mongodb-r2.sh` tạo bản sao MongoDB dạng nén và tải lên R2. Máy chủ cần có `mongodump` và AWS CLI. Cấu hình các biến `R2_*` trong môi trường máy chủ rồi chạy thử:

```bash
bash scripts/backup-mongodb-r2.sh
```

Sau khi kiểm tra khôi phục thành công, đặt cron chạy mỗi ngày và thiết lập quy tắc lưu trữ trên R2, ví dụ giữ bản hằng ngày 30 ngày. Không lưu khóa R2 trong Git.

## An toàn thông tin

- Đổi mật khẩu quản trị và tất cả khóa bí mật trước khi dùng thật.
- Chỉ cấp khóa R2 quyền đọc/ghi cho bucket sao lưu.
- Sao lưu phải nằm ngoài VPS đang chạy ứng dụng.
- Thử khôi phục dữ liệu định kỳ, không chỉ kiểm tra việc tải tệp lên.
