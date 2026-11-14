const INDIA = "91";

/**
 * A "chat on WhatsApp" link for a stored phone number. wa.me needs the full
 * international number, digits only (no +, spaces or leading 0):
 *
 *   "+971 50 123 4567" -> https://wa.me/971501234567   (+ given: used as typed)
 *   "9876543210"       -> https://wa.me/919876543210   (10 digits: an Indian mobile)
 *   "09876543210"      -> https://wa.me/919876543210   (leading 0 dropped first)
 *
 * Numbers are stored as digits with an optional leading "+" and no fixed
 * prefix (customers can be anywhere), so one without "+" that isn't a
 * 10-digit Indian mobile is used as typed. Null = too short to be a number.
 */
export function whatsappLink(phone: string): string | null {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, "");
    const local = digits.replace(/^0+/, "");
    const international = trimmed.startsWith("+") ? digits : local.length === 10 ? INDIA + local : digits;
    return international.length >= 10 ? `https://wa.me/${international}` : null;
}

/** The WhatsApp logo (lucide has no brand icons), drawn in the current text colour. */
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02C2.62 6.86 6.85 2.63 12.06 2.63c2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.7C5.8.7.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.3l5.7-1.5a11.32 11.32 0 0 0 5.75 1.46h.01c6.25 0 11.35-5.1 11.35-11.36 0-3.03-1.18-5.88-3.33-8.02" />
        </svg>
    );
}

// "Try WhatsApp", shown right after a phone number (customer and staff
// pages): opens a chat with that number -- the app on a phone, WhatsApp Web
// on a laptop -- in a new tab. "Try" because the number may not be on
// WhatsApp. Renders nothing for a number too short to use.
export function WhatsAppButton({ phone }: { phone: string }) {
    const href = whatsappLink(phone);
    if (!href) return null;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open a WhatsApp chat with ${phone}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1EBE5A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
        >
            <WhatsAppIcon className="w-3.5 h-3.5" />
            Try WhatsApp
        </a>
    );
}
