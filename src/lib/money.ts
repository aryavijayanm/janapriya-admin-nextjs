/**
 * "₹1,00,000" -- whole rupees with Indian digit grouping (lakh, crore).
 * The ONE formatter for money, used by the server (error messages) and the
 * browser (tables, dialogs). Plain function, no imports: safe on both sides.
 */
export function formatRupees(amount: number): string {
    return `₹${amount.toLocaleString("en-IN")}`;
}
