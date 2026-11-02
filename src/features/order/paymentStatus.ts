// How a contract's paid status looks everywhere (order page today; customer
// page and reports later) -- one place, like ORDER_STATUS_STYLES.
export const PAYMENT_STATUS_STYLES = {
    NOT_PAID: { label: "Not paid", className: "bg-red-100 text-red-700" },
    PARTLY_PAID: { label: "Partly paid", className: "bg-orange-100 text-orange-700" },
    FULLY_PAID: { label: "Fully paid", className: "bg-green-100 text-green-700" },
} as const;
