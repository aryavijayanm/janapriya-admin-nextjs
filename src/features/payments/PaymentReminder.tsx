"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { WhatsAppIcon, whatsappLink } from "@/components/ui/WhatsAppButton";
import { useServerAction } from "@/hooks/useServerAction";
import { formatDateTime } from "@/lib/date";
import { needsPaymentReminder, paymentReminderMessage } from "@/server/domain/payment-reminder";
import type { PaymentsContractRow, PaymentsOrderRow } from "@/server/services/payments-list.service";
import { markReminderSentAction } from "./payments.actions";

const ICON_LINK =
    "inline-flex items-center justify-center rounded-full bg-[#25D366] p-1.5 text-white shadow-sm transition-colors hover:bg-[#1EBE5A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2";

/**
 * The Reminder cell of one payments row (one contract):
 *
 *   1. WhatsApp icon  -> opens WhatsApp with the reminder typed in
 *                        (two numbers? a small popup asks which one first)
 *   2. "Mark as sent" -> appears after WhatsApp opened; saves who + when
 *   3. "Reminder sent 19/11/2026, 10:42 am · Anu" -- at most one per contract
 *
 * Saving is a separate click on purpose: the app can't see whether Send was
 * really pressed in WhatsApp, and with only one reminder per contract an
 * accidental click must not use it up.
 */
export function PaymentReminder({ order, contract }: { order: PaymentsOrderRow; contract: PaymentsContractRow }) {
    const [opened, setOpened] = useState(false);
    const [choosing, setChoosing] = useState(false);
    const { run, isPending, error } = useServerAction();

    if (contract.reminder) {
        return (
            <span className="block text-xs leading-snug text-gray-600 whitespace-nowrap">
                Reminder sent
                <span className="block">
                    {formatDateTime(contract.reminder.sentAt)}
                    {contract.reminder.sentBy && ` · ${contract.reminder.sentBy}`}
                </span>
            </span>
        );
    }

    // Same rule the server checks (domain/payment-reminder.ts).
    if (!needsPaymentReminder(contract) || contract.startDate === null) return null;

    const message = paymentReminderMessage({
        contractNumber: contract.contractNumber,
        startDate: contract.startDate,
        endDate: contract.endDate,
        balance: contract.balance,
    });
    const numbers = [order.customer.contactNumber1, order.customer.contactNumber2].flatMap((phone, i) => {
        const href = phone ? whatsappLink(phone, message) : null;
        return href ? [{ label: `Number ${i + 1}`, phone: phone as string, href }] : [];
    });
    if (numbers.length === 0) return <span className="text-xs text-gray-400">No WhatsApp number</span>;

    return (
        // The row opens the order when clicked. Stop every click in this cell
        // here -- including clicks inside the popup, which React passes up
        // through the portal to this element too.
        <div className="flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
            {numbers.length === 1 ? (
                <a
                    href={numbers[0].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpened(true)}
                    className={ICON_LINK}
                    title={`Send a payment reminder on WhatsApp to ${numbers[0].phone}`}
                    aria-label="Send a payment reminder on WhatsApp"
                >
                    <WhatsAppIcon className="w-4 h-4" />
                </a>
            ) : (
                <button
                    type="button"
                    onClick={() => setChoosing(true)}
                    className={ICON_LINK}
                    title="Send a payment reminder on WhatsApp"
                    aria-label="Send a payment reminder on WhatsApp"
                >
                    <WhatsAppIcon className="w-4 h-4" />
                </button>
            )}

            {opened && (
                <Button
                    size="sm"
                    variant="success"
                    isLoading={isPending}
                    onClick={() => run(() => markReminderSentAction(contract.id))}
                    className="whitespace-nowrap"
                    title="Press after you have sent the message in WhatsApp"
                >
                    Mark as sent
                </Button>
            )}
            {error && <span className="text-xs text-red-600">{error}</span>}

            <Modal isOpen={choosing} onClose={() => setChoosing(false)} title="Send reminder to" size="sm">
                <div className="space-y-2">
                    {numbers.map((n) => (
                        <a
                            key={n.label}
                            href={n.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                                setOpened(true);
                                // Close AFTER the browser has followed the link: closing
                                // right away could remove the link before it opens.
                                setTimeout(() => setChoosing(false), 0);
                            }}
                            className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:border-[#25D366] hover:bg-green-50"
                        >
                            <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                            <span className="text-sm">
                                <span className="font-semibold text-gray-800">{n.label}</span>
                                <span className="ml-2 text-gray-600">{n.phone}</span>
                            </span>
                        </a>
                    ))}
                </div>
            </Modal>
        </div>
    );
}
