import { formatRupees } from "@/lib/money";

// How a contract's paid status looks everywhere (order page, payments table,
// customer page and reports later) -- one place, like ORDER_STATUS_STYLES.
export const PAYMENT_STATUS_STYLES = {
    NOT_PAID: { label: "Not paid", className: "bg-red-100 text-red-700" },
    PARTLY_PAID: { label: "Partly paid", className: "bg-orange-100 text-orange-700" },
    FULLY_PAID: { label: "Fully paid", className: "bg-green-100 text-green-700" },
} as const;

/**
 * The pill for one contract. A written-off contract counts as settled
 * (FULLY_PAID) but says so -- "Written off ₹3,000", never "Fully paid".
 */
export function paymentStatusStyle(contract: {
    paymentStatus: keyof typeof PAYMENT_STATUS_STYLES;
    writtenOffAmount: number;
}): { label: string; className: string } {
    if (contract.writtenOffAmount > 0) {
        return { label: `Written off ${formatRupees(contract.writtenOffAmount)}`, className: "bg-gray-200 text-gray-700" };
    }
    return PAYMENT_STATUS_STYLES[contract.paymentStatus];
}
