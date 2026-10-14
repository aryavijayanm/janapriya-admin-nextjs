import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
    label: string;
}

// Reuses the .checkbox utility class already defined in globals.css.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, id, className, ...props }, ref) => {
        return (
            <label
                htmlFor={id}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none"
            >
                <input
                    ref={ref}
                    type="checkbox"
                    id={id}
                    className={cn("checkbox", className)}
                    {...props}
                />
                {label}
            </label>
        );
    }
);

Checkbox.displayName = "Checkbox";
