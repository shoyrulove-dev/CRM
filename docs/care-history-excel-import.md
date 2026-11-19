# Import lịch sử CSKH bằng số điện thoại

## Phạm vi

- Nút **Import Excel CSKH** tại Khách hàng và Lịch chăm sóc, chỉ admin/super admin. API kiểm tra lại quyền theo tài khoản hiện hành cho mọi phương thức, không chỉ ẩn nút.
- Chỉ thêm nhật ký cho khách CRM đã có. Không tạo khách mới, không sửa tên/SĐT/chủ sở hữu, ngày chăm gần nhất, lịch chăm tiếp theo, đơn hàng hoặc Loyalty.
- Khớp SĐT sau chuẩn hóa dấu phân cách và +84/0084; chặn không tìm thấy hoặc khớp nhiều khách. SĐT mất số 0 đầu chỉ được đề xuất với cảnh báo để quản trị xác nhận.
- Tên khác CRM hoặc nhân viên khác người phụ trách hiện tại: cảnh báo, không chuyển phụ trách. Nhân viên không tồn tại/đã khóa/trùng tên: chặn.

## File và luồng nhập

- Dùng đúng 17 tiêu đề của file mẫu đã đối chiếu; nút **Tải file mẫu** xuất mẫu trống. Có thể đổi thứ tự cột; không nhận cột bắt buộc thiếu/trùng.
- .xlsx tối đa 2 MB, 500 dòng; kiểm tra cấu trúc ZIP và tổng kích thước giải nén khai báo, chặn công thức/ô lỗi. Dòng trống được bỏ qua.
- Hỗ trợ ngày serial Excel 1900/1904, dd/mm/yyyy, yyyy-mm-dd và thời gian kèm giờ. Ngày không có giờ được lưu với dấu hiệu date-only và mốc đầu ngày Việt Nam, không coi là biết giờ thực tế.
- Chuẩn hóa Nhắn tin Zalo → Zalo. Điểm hài lòng 1–5; phản ứng trống không tự gán Không. Giữ số lần chăm từ Excel và các giá trị gốc phục vụ đối chiếu.
- Chỉ tính chỉ số Nhắc đúng lúc cho mục đích Nhắc tái mua; khác giá trị trong file hoặc thiếu ngày thì cảnh báo.
- Xem trước tạo dữ liệu tạm hết hạn sau 30 phút, ràng buộc admin đã tải file. Không ghi nhật ký ở bước này. Dòng sạch được chọn sẵn; dòng cảnh báo phải chọn riêng và đánh dấu xác nhận. Dòng lỗi/nghi trùng không chọn được.
- Xác nhận kiểm tra lại SĐT, mã khách, tên, người phụ trách và nhân viên. Nếu hồ sơ đổi từ lúc xem trước, yêu cầu xem lại.
- Chống trùng cả trong file, với lịch sử có sẵn và các lượt upload/nhấn xác nhận lặp. Khóa theo đợt nhập và chỉ mục unique cho importKey bảo vệ các lượt nhập đồng thời. So sánh thận trọng theo khách/ngày Việt Nam/nhân viên/kênh/mục đích/liên lạc/kết quả/ghi chú; nhật ký tương tự bị bỏ qua, không ghi đè.
- Có kết quả từng dòng và tải CSV; giữ nguồn file/hash/dòng, mã đợt, người nhập trên nhật ký và audit tổng kết. Báo cáo CSV trung hòa ký tự mở đầu công thức.
- Nếu request lỗi sau khi đã ghi một phần, thử lại cùng đợt không tạo trùng. Chưa có nút hoàn tác hàng loạt; mọi yêu cầu hoàn tác cần dựa vào importBatchId và được quản trị duyệt.

## Kiểm thử

- `npm run test:import`: parser, ngày/SĐT, schema, chống trùng, snapshot, quyền và tính không thay đổi hồ sơ/lịch chăm.
- E2E `care-import.spec.ts`: nút admin, xem trước/xác nhận cảnh báo, thử lại lỗi và chặn sale. Ghi nhật ký được giả lập tại trình duyệt, không nhập mẫu vào dữ liệu thật.
- Không tự nhập file mẫu của người dùng lên production khi triển khai nút.

## Kết quả cập nhật VPS ngày 19/11/2026

- Cập nhật dịch vụ CRM hiện hữu tại /opt/NichieiCRM trên 103.118.29.93, không thêm stack và không khởi động lại MongoDB/NikiFX/Hub.
- Sao lưu source và MongoDB sau vòng Loyalty tại /var/backups/nichiei-care-import-20261119T0434; giữ image rollback nichieicrm-crm:before-care-import-20261119.
- 10 kiểm thử import, 14 Loyalty và 6 E2E desktop/mobile đạt; typecheck, lint, build local và image VPS đạt.
- Kiểm tra live: nút admin có mặt, tải mẫu thành công, sale bị chặn GET/POST/PUT. Xem trước file mẫu thực ghép duy nhất một khách và có cảnh báo đúng dự kiến.
- Không gọi bước xác nhận khi kiểm tra production. Số nhật ký nguồn excel-import trước/sau không đổi; bản xem trước thử đã được dọn theo đúng mã đợt.
- CRM healthy và MongoDB connected sau cập nhật.
