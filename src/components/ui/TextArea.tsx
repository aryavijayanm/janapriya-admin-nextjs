import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: boolean;
}

/** The counter appears once the text reaches this share of maxLength. */
const COUNTER_FROM = 0.8;

// Same .input-field base as Input.tsx -- textarea just needs a taller default height.
// With maxLength, typing stops at the limit and a small "812 / 1000" counter
// shows once the text is close to it (the schema checks the same number).
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
    ({ error = false, className, rows = 3, maxLength, value, ...props }, ref) => {
        const length = typeof value === "string" ? value.length : 0;
        const showCounter = maxLength !== undefined && length >= maxLength * COUNTER_FROM;

        const textarea = (
            <textarea
                ref={ref}
                rows={rows}
                maxLength={maxLength}
                value={value}
                className={cn(
                    "input-field resize-y",
                    error && "border-red-400 focus:border-red-500 focus:ring-red-500",
                    className
                )}
                {...props}
            />
        );

        if (maxLength === undefined) return textarea;
        return (
            <div>
                {textarea}
                {showCounter && (
                    <p className={cn("mt-1 text-right text-xs tabular-nums", length >= maxLength ? "text-red-600" : "text-gray-500")}>
                        {length} / {maxLength}
                    </p>
                )}
            </div>
        );
    }
);

TextArea.displayName = "TextArea";
