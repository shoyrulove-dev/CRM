import { Plus, Search } from "lucide-react";

const tickets = [
  ["YC-1038", "Phản ứng không mong muốn sau khi dùng", "Nguyễn Thị Mai", "Khẩn cấp", "Đang xử lý", "Vân Anh"],
  ["YC-1037", "Yêu cầu đổi sản phẩm", "Trần Hùng", "Cao", "Mới", "Trâm"],
  ["YC-1036", "Cần tư vấn thêm về liệu trình", "Bùi Thu Trâm", "Bình thường", "Chờ khách", "Linh"],
];
export default function TicketsPage(){return <><div className="page-heading compact"><div><p className="eyebrow">HỖ TRỢ KHÁCH HÀNG</p><h1>Phiếu yêu cầu</h1><p>Theo dõi phản ánh, đổi trả và các yêu cầu cần phối hợp.</p></div><button className="primary-button"><Plus size={18}/>Tạo phiếu yêu cầu</button></div><section className="panel list-panel"><div className="list-toolbar"><div className="search-box"><Search size={18}/><input placeholder="Tìm mã phiếu, khách hàng..."/></div></div><div className="table-wrap"><table><thead><tr><th>MÃ PHIẾU</th><th>NỘI DUNG</th><th>KHÁCH HÀNG</th><th>ƯU TIÊN</th><th>TRẠNG THÁI</th><th>PHỤ TRÁCH</th></tr></thead><tbody>{tickets.map(t=><tr key={t[0]}><td><strong>{t[0]}</strong></td><td><strong>{t[1]}</strong></td><td>{t[2]}</td><td><span className={`priority ${t[3]==="Khẩn cấp"?"urgent":""}`}>{t[3]}</span></td><td><span className="segment">{t[4]}</span></td><td>{t[5]}</td></tr>)}</tbody></table></div></section></>}
