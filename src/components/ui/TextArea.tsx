import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: boolean;
}

// Same .input-field base as Input.tsx -- textarea just needs a taller default height.
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
    ({ error = false, className, rows = 3, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                rows={rows}
                className={cn(
                    "input-field resize-y",
                    error && "border-red-400 focus:border-red-500 focus:ring-red-500",
                    className
                )}
                {...props}
            />
        );
    }
);

TextArea.displayName = "TextArea";
