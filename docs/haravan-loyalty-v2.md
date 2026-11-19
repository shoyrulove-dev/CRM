# Đồng bộ Loyalty Haravan V2

## Hợp đồng dữ liệu

- Giữ API danh sách V1 để nhập khách/đơn; không đoán tham số endpoint danh sách V2 đang trả 422.
- Đọc chi tiết `GET https://apis.haravan.com/com/v2/customers/{customer_id}.json` với Bearer token từ cấu hình tích hợp đang lưu.
- Chấp nhận phản hồi `{ customer: { id, membership: { name, reward_point_amount, reward_expire_date } } }`. Kiểm tra mã khách khớp trước khi ghi.
- Ánh xạ sang `membershipTier`, `loyaltyPoints`, `loyaltyExpiresAt`, `loyaltySyncedAt`. Lưu đúng điểm bằng 0; không tự tính hoặc suy ra từ doanh thu/nhóm khách.
- Kiểm tra live xác nhận membership.name có thể null: ghi hạng rỗng và hiển thị Chưa có hạng (khác Chưa đồng bộ), vẫn lưu điểm số hợp lệ từ phản hồi.
- Thiếu/null membership, hạng/điểm sai kiểu, ngày hết hạn không hợp lệ hoặc lỗi HTTP: giữ nguyên dữ liệu cũ, ghi lỗi vận hành và hẹn thử lại sau 1 giờ. Không diễn giải thiếu dữ liệu thành 0 điểm.
- Chỉ xử lý khách CRM có `haravanId` dạng chuỗi số; bỏ qua mã khách giả từ đơn không có khách.

## Vận hành

- Cài đặt → Haravan → **Đồng bộ hạng/điểm V2**. Giữ trang mở để tự chạy tiếp; nút dừng có hiệu lực sau lô đang chạy. Dừng tự động nếu lỗi xác thực/quyền/giới hạn tốc độ hoặc một tiến trình khác giữ khóa. Lỗi riêng lẻ được hẹn thử lại, không chặn các khách còn lại.
- Một lượt tối đa 50 khách và ngân sách gọi API 70 giây, yêu cầu tuần tự cách nhau 300 ms; HTTP timeout 12 giây, tối đa 3 lần cho 429/5xx, tôn trọng Retry-After (chờ dài thì để lượt sau). Không ghi token hay phản hồi chứa dữ liệu cá nhân vào log.
- Khóa MongoDB có hạn 180 giây, nhả khóa theo chủ sở hữu. Khách thành công hẹn cập nhật sau 24 giờ. Danh sách ưu tiên khách chưa thử; tiếp tục lấy các khách đến hạn kể cả khi khách không có thay đổi ở API V1.
- Route `/api/internal/haravan-loyalty-sync` nhận GET/POST, yêu cầu CRON_SECRET hoặc phiên quản trị theo cơ chế internal hiện có. Route đồng bộ khách/đơn hiện tại gọi thêm một lô Loyalty sau khi nhập xong; lỗi Loyalty được báo riêng, không đổi kết quả nhập khách/đơn.
- VPS Nichiei 103.118.29.93 đã có cron khách/đơn mỗi 5 phút. Route đó chạy thêm một lô Loyalty khi còn ngân sách thời gian, không cần thêm cron/dịch vụ. Giữ các cron khách/đơn, scheduler và backup hiện có. Token không cần nhập lại.
- Không thêm cron riêng: lịch đồng bộ Haravan hiện hữu gọi thêm một lô Loyalty. Nút Cập nhật hạng/điểm trong hồ sơ dùng API chi tiết V2, kiểm tra phạm vi nhân viên và giới hạn một lần/phút/khách; lỗi không xóa dữ liệu cũ.
- Sau khi triển khai, có thể chạy `node --env-file=.env.vps scripts/sync-haravan-loyalty.cjs --all` trên máy có file cấu hình phù hợp; script chỉ gọi route mới trên APP_URL, không ghi trực tiếp MongoDB và không gọi route đồng bộ khách/đơn. Không in bí mật.
- Thiếu membership vẫn được báo là chưa đồng bộ; cần kiểm tra schema/quy ước của Haravan trước khi quyết định xóa hạng/điểm cũ.

## Kiểm tra

Chạy `npm run test:haravan`, `npm run typecheck`, `npm run lint`, `npm run build`. Kiểm thử tự động dùng phản hồi giả, không gọi Haravan hoặc MongoDB thật. Kết quả live/backfill phải báo riêng sau khi chạy trên môi trường triển khai.

## Cập nhật thực tế ngày 19/11/2026 (UTC+7)

- Cập nhật chính dịch vụ CRM tại `/opt/NichieiCRM` trên 103.118.29.93; giữ nguyên domain/cổng/MongoDB/token, không thêm stack hay khởi động lại NikiFX/Hub.
- Sao lưu source và MongoDB trước thay đổi tại `/var/backups/nichiei-loyalty-v2-20261119T0347`; giữ image cũ với tag `nichieicrm-crm:before-loyalty-v2-20261119`.
- 14 kiểm thử offline đạt; typecheck, lint, build local và build image VPS đạt. Container sau cập nhật healthy, kiểm tra sức khỏe báo database connected.
- Lô thật đầu tiên: 49 cập nhật, 1 lỗi đọc, 3.706 khách đủ điều kiện. Lỗi không xóa dữ liệu cũ. Đây là kết quả lô đầu, không phải tuyên bố toàn bộ backfill đã hoàn tất.
- Lượt xác minh 03:55 UTC+7: 142 khách đã có dữ liệu, 37 khách có điểm dương, 11 khách có hạng. Đọc lại 5 bản ghi vừa lưu từ V2 đều khớp hạng/điểm/ngày hết hạn. Các lô nền tiếp tục chạy; số lượng này là ảnh chụp tại thời điểm kiểm tra.
- Log backfill: `/var/log/nichiei-loyalty-v2-backfill-20261119.log`. Backfill dùng cùng route/khóa với cron, không chạy trùng lô. Không xác nhận hoàn tất toàn bộ khi log/cơ sở dữ liệu chưa chứng minh điều đó.
