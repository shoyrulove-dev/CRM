# Báo cáo một vòng đồng bộ Loyalty V2 — 19/11/2026

## Môi trường và kết quả

- VPS Nichiei: 103.118.29.93, CRM hiện hữu tại /opt/NichieiCRM. Không thay đổi hệ thống NikiFX/Hub.
- Đã quét một vòng toàn bộ 3.706 khách có mã Haravan hợp lệ trong CRM. Tiến trình backfill đã kết thúc, không còn khách đến lượt ngay tại thời điểm kết thúc.
- Thành công: **3.705 / 3.706 (99,97%)**.
- Ngoại lệ: **1 khách**, API chi tiết V2 trả **422 Unprocessable Entity**. Lượt đọc kiểm chứng sau đó vẫn trả 422, trong khi API chi tiết V1 cùng mã trả 200. Không kết luận khách đã xóa hoặc thiếu quyền; cần Haravan kiểm tra bản ghi/khả năng hỗ trợ V2.
- Mã khách CRM cần kiểm tra: **HRV-KH-1153737676**. Đã thử đọc lại V2 sau vòng backfill, vẫn 422; V1 vẫn 200. Không đưa tên hoặc SĐT khách vào báo cáo kỹ thuật.
- Không tự gán 0 điểm, không xóa hạng/điểm cũ cho bản ghi lỗi. Bản ghi được giữ để thử lại theo lịch; không ghi đè hồ sơ, chủ sở hữu, doanh thu hay đơn hàng.

## Phân bố tại lượt kiểm chứng

| Nhóm | Số khách |
|---|---:|
| Có điểm dương | 2.526 |
| Điểm bằng 0 | 1.179 |
| Diamond | 5 |
| Gold | 19 |
| VIP | 2 |
| Silver | 198 |
| Chưa có hạng, V2 trả tên hạng null | 3.481 |

Tổng nhóm điểm và tổng nhóm hạng đều bằng 3.705 khách đã đồng bộ. Chưa có hạng là dữ liệu thực từ V2, khác với Chưa đồng bộ ở bản ghi lỗi.

## Kiểm chứng và duy trì

- Đọc lại 5 bản ghi đã lưu từ API V2: hạng/điểm/ngày hết hạn khớp. Bộ 14 kiểm thử Loyalty, typecheck, lint và build đạt.
- CRM healthy và MongoDB connected sau cập nhật.
- Lịch khách/đơn mỗi 5 phút hiện có xử lý thêm lô Loyalty; dữ liệu thành công được đưa lại vào hàng đợi sau 24 giờ, lỗi sau 1 giờ. Không tạo cron hoặc dịch vụ mới.
- Script `scripts/report-haravan-loyalty.cjs` tạo báo cáo chỉ-đọc và kiểm chứng V1/V2 cho khách còn thiếu. Log vòng backfill: /var/log/nichiei-loyalty-v2-backfill-20261119.log.
- Một vòng đã hoàn tất xử lý, nhưng **không tuyên bố 100% khách đã có Loyalty** khi còn ngoại lệ từ Haravan.
