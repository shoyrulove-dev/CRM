export const defaultCareAutomation = {
  orders: true, birthdays: true, holidays: true, activeFrom: "",
  orderRules: [
    { offset: 7, purpose: "Khảo sát tình trạng sử dụng sau 7 ngày", channel: "Gọi điện" },
    { offset: 25, purpose: "Khảo sát liệu trình và mức độ hài lòng", channel: "Gọi điện" },
    { offset: 25, purpose: "Nhắc tái mua để duy trì liệu trình", channel: "Zalo" },
    { offset: 45, purpose: "Duy trì tương tác với khách hàng", channel: "Zalo" },
  ],
};
