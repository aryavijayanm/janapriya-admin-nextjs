"use client";

import { Modal } from "@/components/ui/Modal";

// The daily checklist for office staff. To add, remove or reword a point,
// change this list only -- the modal numbers them by itself.
// Simple English on purpose: most readers are not native English speakers.
const DAILY_TASKS: string[] = [
    "Enter duty assignments. Contracts will update automatically.",
    "Check Activities. It shows what was done on a day. It also shows the orders and staff that completed 28 days of a contract.",
    "When a contract completes 28 days, collect the next payment from the customer.",
    "Enter every customer payment on the same day you get the money.",
    "Enter every amount paid to staff (salary or advance) in the staff's account on the same day.",
    "Add any other expenses in the Accounts book, like rent, bills, etc. Staff payments and customer receipts come in automatically.",
    "Check the Dashboard for money to collect from customers.",
    "Before you go home, check today's Accounts book. The money in hand should match today's receipts and payments.",
];

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="THINGS TO DO EVERYDAY" size="md">
            <ol className="space-y-3">
                {DAILY_TASKS.map((task, index) => (
                    <li key={task} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums">
                            {index + 1}
                        </span>
                        <span className="pt-0.5">{task}</span>
                    </li>
                ))}
            </ol>
        </Modal>
    );
}
