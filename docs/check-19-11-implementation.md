# Check 19.11 — bản nâng cấp

## Chức năng

- Phân công dùng chung Modal thay vì đặt form lên lớp nền tuyệt đối, xử lý đang lưu/lỗi mạng; API kiểm tra người nhận đang hoạt động. Chuyển chủ hồ sơ và công việc mở, giữ người bán lịch sử trong đơn.
- Tệp khách lọc theo sản phẩm/người phụ trách độc lập với cách giao việc. Theo hồ sơ không cần người nhận cụ thể. Chốt tệp khách tại lúc tạo chương trình.
- Tạo theo lô tối đa 200 khách, không giới hạn 1.000 khách. Request key chống tạo lại chương trình khi retry; khóa từng chương trình, task ID ổn định chống trùng khi lô lỗi giữa chừng. Tắt trang không hủy chương trình; scheduler tiếp tục các lô.
- Chu kỳ: không lặp/tuần/tháng/quý/năm/số ngày (1–3650). Theo giờ Việt Nam, cuối tháng không tràn sang tháng kế tiếp; giữ ngày mốc. Lịch đơn lặp sau khi hoàn thành, chương trình lặp theo ngày độc lập. Chương trình chỉ sinh trước tối đa 30 ngày; không sinh hàng loạt tất cả các kỳ đã bỏ lỡ.
- Chương trình chăm sóc: phân trang 10 chương trình, xem tiến độ, sửa nội dung/chu kỳ/ngày kết thúc, tạm dừng/tiếp tục/kết thúc. Không sửa nội dung khi lô hiện tại đang dở. Các lịch đã giao giữ nguyên.
- Cài đặt tự động: bật/tắt nguồn đơn/sinh nhật/ngày lễ, thêm/sửa/bỏ nội dung và số ngày sau mua; mốc ngày áp dụng tránh sinh lại lịch cũ. Lịch lễ riêng dùng chương trình hàng loạt, Tết dùng lịch sẵn có trong scheduler.
- Import: Chọn tất cả dòng có thể nhập, bỏ chọn tất cả, giải thích nhập 0 dòng. Dòng lỗi/nghi trùng không được chọn; cảnh báo phải xác nhận riêng.
- Báo cáo: số khách trong kỳ và số đơn cùng bộ lọc, khách tái mua trong kỳ có đơn Mua lại trong kỳ; lũy kế tách riêng. Công thức doanh thu mua lại hiển thị rõ, không quy doanh thu cho CSKH hoặc tự khấu trừ hoàn tiền chưa có dữ liệu.
- Loyalty: giữ tác vụ nền hiện có; thêm nút lấy số mới trong hồ sơ theo phạm vi quyền, giới hạn một lần/phút. Không gọi là realtime; một ngoại lệ V2 422 vẫn cần Haravan xử lý.

## Dọn dữ liệu

Đã sao lưu trước nâng cấp vào `/var/backups/nichiei-crm-check1911-20261119/` (quyền truy cập chỉ chủ sở hữu). Script `scripts/archive-check1911.cjs` mặc định dry-run, chỉ `--commit` mới chuyển dữ liệu sang kho lưu trữ rồi gỡ khỏi collection vận hành.

Phạm vi: lịch có thời điểm tạo trước 07:50 UTC ngày 19/11/2026 và 4 ID lịch seed đã xác minh; 5 ID phiếu được liệt kê trong Excel; 3 ID nhật ký seed. Không đụng khách/đơn/Loyalty/tài khoản. Lịch/chương trình mới sau mốc không bị dọn. Khóa scheduler khi chuyển; tắt nguồn tự sinh cũ để admin cài lại.

Kho lưu trữ: `care_tasks_archive_check1911`, `service_tickets_archive_check1911`, `care_activities_archive_check1911`. Mỗi lô xác minh đủ bản sao trước khi gỡ bản vận hành, giữ `_id` gốc. Có thể khôi phục từng bản bằng upsert `$setOnInsert` về collection gốc; phải giữ nguồn tự sinh tắt trong lúc phục hồi. Không ghi đè dữ liệu vận hành mới.

Trạng thái chăm sóc tính sẵn trên hồ sơ (lastCare/nextCare/status) được lưu riêng vào `customer_care_state_archive_check1911` rồi làm trống cho khách chỉ có lịch/nhật ký cũ, không có việc mới còn hoạt động. Tên, SĐT, người phụ trách, đơn, doanh thu và Loyalty không thay đổi.

## Kiểm thử

`npm run test:check1911` kiểm tra chu kỳ, cuối tháng/năm nhuận, báo cáo, 1.201 khách, retry lô lỗi, chương trình tạm dừng và nằm ngoài khoảng sinh lịch.

E2E mới `tests/e2e/check1911.spec.ts`: tách tệp khách/người nhận, biểu mẫu phân công, quản lý chương trình, báo cáo, quyền nhân viên. Các thao tác ghi được giả lập để không tạo dữ liệu thử thật.

Kết quả triển khai/kiểm tra production và số lượng dọn phải đối chiếu log thực tế, không suy ra từ tài liệu này.
