# Cập nhật tab Check 16.11 — 17/11/2026

## Đã triển khai

- Danh sách phân nhóm: Chưa xác định, Trung thành, Vãng lai. Mục tiêu sức khỏe đầy đủ theo Excel; dùng chung khi tạo, sửa khách và ghi nhận chăm sóc.
- Sửa phân nhóm dùng select thay datalist. Giữ nguyên lựa chọn cũ, chỉ đổi nhãn tương đương khi người dùng lưu. API chặn giá trị mới ngoài danh sách, vẫn cho giữ nhãn lịch sử.
- Danh mục đúng 26 sản phẩm Check 14.11, đối chiếu SKU thật bằng Products API của cửa hàng. Không nhập quà tặng/phí vào danh mục đổi sang. Hàng thu lại vẫn lấy từ đơn gốc. Không sửa lịch sử đơn/phiếu.
- Bộ chọn tháng có nhãn, không phụ thuộc input month của Safari. Có Tháng này, Tháng trước, Xóa lọc; sắp xếp đơn gần nhất/lâu chưa mua độc lập trên khách hàng.
- Tháng nhuận, tháng 28/30/31 ngày và mốc giờ Việt Nam được xử lý chung. Xuất Excel phiếu dùng cùng khoảng tháng và từ khóa đang lọc.
- Có chọn ngày cụ thể ở Khách hàng / Lịch chăm sóc / Phiếu yêu cầu. Ngày cụ thể được ưu tiên hơn khoảng tháng, lọc nhanh theo tháng tự bỏ ngày cụ thể. Xuất Excel áp dụng cùng điều kiện.
- Thống kê trạng thái khách tính trên toàn bộ kết quả lọc, không phải trang hiện tại. Các chip đếm độc lập với trạng thái đang chọn.
- Chỗ hiển thị hạng/điểm tại danh sách và hồ sơ; thiếu dữ liệu hiển thị Chưa đồng bộ, không tự tính điểm/hạng.

## Còn phụ thuộc Haravan — chưa thể xác nhận hoàn tất Loyalty

Đã gọi GET customers.json bằng token đang lưu trên VPS: HTTP 200. Phản hồi mẫu không có trường điểm/hạng; group_name trả null. Không dùng group_name hoặc tags/doanh thu để suy ra hạng thành viên.

Cần Haravan cung cấp endpoint/schema/quyền đọc Loyalty áp dụng cho cửa hàng Nichiei (phiên bản chương trình thành viên đang sử dụng), cùng sự kiện hoặc cơ chế cập nhật. Không đoán endpoint hoặc ghi dữ liệu giả lên CRM. Hiện chưa có luồng đồng bộ hạng/điểm thực tế.

Hợp đồng dữ liệu CRM đã dành sẵn membershipTier, loyaltyPoints, loyaltySyncedAt; các trường không nằm trong danh sách sửa thủ công của API khách hàng.

## Phạm vi an toàn

Không xóa dữ liệu, không thay tên sản phẩm trong đơn cũ, không tự phân nhóm khách theo suy đoán, không thay cấu hình token/R2 hoặc cơ chế webhook hiện tại. Bộ lọc khách vẫn lọc theo ngày đơn gần nhất, có ghi rõ nhãn.

## Kiểm thử

- Build production và TypeScript.
- E2E check1611: lựa chọn, đúng 26 SKU, mốc tháng/múi giờ, lọc nhanh, sắp xếp, số lượng trạng thái; desktop/mobile.
- Quét ký tự lỗi trong mã nguồn.
- Quét dữ liệu VPS ngày 17/11: không phát hiện ký tự hỏng trong 17 collection, gồm 3.693 khách, 5.953 đơn, 16.831 lịch chăm sóc và nhật ký.
- Kết quả kiểm thử bản triển khai được báo riêng khi hoàn tất, không xem việc build thành công là bằng chứng đồng bộ Loyalty.
