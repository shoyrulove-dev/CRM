"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Modal } from "./modal";
import { ImportCareButton } from "./import-care-button";
import { PurchaseHistoryImport } from "./purchase-history-import";

export function CustomerDataImport({ canImportPurchases }: { canImportPurchases: boolean }) {
  const [step, setStep] = useState<"closed" | "choose" | "care" | "purchases">("closed");
  const back = () => setStep("choose");
  return <>
    <button type="button" className="secondary-button" onClick={back}><Upload size={16} />Nhập dữ liệu khách hàng</button>
    {step === "choose" && <Modal title="Nhập dữ liệu khách hàng" description="Chọn loại dữ liệu trong tệp Excel." onClose={() => setStep("closed")}>
      <div className="entity-form">
        <div>
          <button type="button" className="secondary-button" onClick={() => setStep("care")}>Nhật ký CSKH</button>
          <p>Ngày chăm, nhân viên, kênh và kết quả chăm sóc.</p>
        </div>
        {canImportPurchases && <div>
          <button type="button" className="secondary-button" onClick={() => setStep("purchases")}>Lịch sử mua</button>
          <p>Ngày mua, SĐT, mã đơn và SKU để đối chiếu báo cáo mua lại.</p>
        </div>}
      </div>
    </Modal>}
    {step === "care" && <ImportCareButton onBack={back} />}
    {step === "purchases" && canImportPurchases && <PurchaseHistoryImport onBack={back} />}
  </>;
}
