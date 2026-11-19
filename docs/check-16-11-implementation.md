# Cập nhật tab Check 16.11 — 17/11/2026

## Hai lỗi bổ sung sau rà soát

- Biểu mẫu tạo khách luôn thoát trạng thái Đang lưu sau thành công, lỗi máy chủ, lỗi mạng hoặc quá thời gian chờ. Lỗi không làm mất nội dung đang nhập; có thể mở lại và tạo tiếp.
- Số trang khách hàng được chuẩn hóa và giới hạn theo tổng kết quả trước khi lấy danh sách. Phần hiển thị sử dụng đúng số trang thực tế, gồm cả trường hợp không có kết quả.
- Kiểm thử chống tái phát nằm ở `tests/e2e/customer-regressions.spec.ts`. Các yêu cầu tạo khách trong kiểm thử được chặn và giả lập tại trình duyệt, không ghi khách thử vào cơ sở dữ liệu.

## Đã triển khai

- Danh sách phân nhóm: Chưa xác định, Trung thành, Vãng lai. Mục tiêu sức khỏe đầy đủ theo Excel; dùng chung khi tạo, sửa khách và ghi nhận chăm sóc.
- Sửa phân nhóm dùng select thay datalist. Giữ nguyên lựa chọn cũ, chỉ đổi nhãn tương đương khi người dùng lưu. API chặn giá trị mới ngoài danh sách, vẫn cho giữ nhãn lịch sử.
- Danh mục đúng 26 sản phẩm Check 14.11, đối chiếu SKU thật bằng Products API của cửa hàng. Không nhập quà tặng/phí vào danh mục đổi sang. Hàng thu lại vẫn lấy từ đơn gốc. Không sửa lịch sử đơn/phiếu.
- Bộ chọn tháng có nhãn, không phụ thuộc input month của Safari. Có Tháng này, Tháng trước, Xóa lọc; sắp xếp đơn gần nhất/lâu chưa mua độc lập trên khách hàng.
- Tháng nhuận, tháng 28/30/31 ngày và mốc giờ Việt Nam được xử lý chung. Xuất Excel phiếu dùng cùng khoảng tháng và từ khóa đang lọc.
- Có chọn ngày cụ thể ở Khách hàng / Lịch chăm sóc / Phiếu yêu cầu. Ngày cụ thể được ưu tiên hơn khoảng tháng, lọc nhanh theo tháng tự bỏ ngày cụ thể. Xuất Excel áp dụng cùng điều kiện.
- Thống kê trạng thái khách tính trên toàn bộ kết quả lọc, không phải trang hiện tại. Các chip đếm độc lập với trạng thái đang chọn.
- Chỗ hiển thị hạng/điểm tại danh sách và hồ sơ; thiếu dữ liệu hiển thị Chưa đồng bộ, không tự tính điểm/hạng.

## Loyalty V2 — bổ sung ngày 19/11/2026

Đã gọi GET customers.json bằng token đang lưu trên VPS: HTTP 200. Phản hồi mẫu không có trường điểm/hạng; group_name trả null. Không dùng group_name hoặc tags/doanh thu để suy ra hạng thành viên.

Kết quả kiểm tra VPS do người vận hành cung cấp xác nhận API chi tiết V2 trả hạng, điểm và ngày hết hạn với token hiện tại. Nhận định trước đây về việc chờ thêm API/quyền chỉ dựa trên V1 và không còn áp dụng cho lượt đọc V2 đã kiểm chứng. API danh sách V2 trả 422, chưa đổi luồng danh sách sang V2.

Đã bổ sung đồng bộ qua API chi tiết V2 theo từng khách, khóa chống chạy chồng, lô tối đa 50 khách/70 giây, giới hạn tốc độ và thử lại lỗi 429/5xx. Lỗi hoặc thiếu membership giữ nguyên dữ liệu Loyalty cũ. Thành công được làm mới sau 24 giờ; lỗi được thử lại sau 1 giờ. Nút Đồng bộ hạng/điểm V2 chạy tiếp các lô khi giữ trang mở. Đã cập nhật CRM hiện hữu trên VPS Nichiei 103.118.29.93 và xác minh các lô thật; lịch đồng bộ mỗi 5 phút hiện có chạy thêm một lô Loyalty, không thêm stack/cron. Chi tiết vận hành và kết quả ban đầu tại [haravan-loyalty-v2.md](haravan-loyalty-v2.md).

Hợp đồng dữ liệu CRM đã dành sẵn membershipTier, loyaltyPoints, loyaltySyncedAt; các trường không nằm trong danh sách sửa thủ công của API khách hàng.

## Phạm vi an toàn

Không xóa dữ liệu, không thay tên sản phẩm trong đơn cũ, không tự phân nhóm khách theo suy đoán, không thay cấu hình token/R2 hoặc cơ chế webhook hiện tại. Bộ lọc khách vẫn lọc theo ngày đơn gần nhất, có ghi rõ nhãn.

## Kiểm thử

- Build production và TypeScript.
- E2E check1611: lựa chọn, đúng 26 SKU, mốc tháng/múi giờ, lọc nhanh, sắp xếp, số lượng trạng thái; desktop/mobile.
- Quét ký tự lỗi trong mã nguồn.
- Quét dữ liệu VPS ngày 17/11: không phát hiện ký tự hỏng trong 17 collection, gồm 3.693 khách, 5.953 đơn, 16.831 lịch chăm sóc và nhật ký.
- Kết quả kiểm thử bản triển khai được báo riêng khi hoàn tất, không xem việc build thành công là bằng chứng đồng bộ Loyalty.
