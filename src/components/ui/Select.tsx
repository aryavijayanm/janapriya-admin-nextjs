import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    error?: boolean;
}

// Same .input-field base as Input.tsx/TextArea.tsx -- @tailwindcss/forms (already
// installed) handles the native <select> arrow/reset styling underneath it.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ error = false, className, children, ...props }, ref) => {
        return (
            <select
                ref={ref}
                className={cn(
                    "input-field",
                    error && "border-red-400 focus:border-red-500 focus:ring-red-500",
                    className
                )}
                {...props}
            >
                {children}
            </select>
        );
    }
);

Select.displayName = "Select";
