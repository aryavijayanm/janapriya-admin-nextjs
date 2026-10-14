import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    leadingIcon?: ReactNode;
}

// Reuses the .input-field utility class already defined in globals.css (@layer
// components) so this component and any plain <input className="input-field">
// left elsewhere in the app stay visually identical -- one source of truth.
export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ error = false, leadingIcon, className, ...props }, ref) => {
        const inputElement = (
            <input
                ref={ref}
                className={cn(
                    "input-field",
                    leadingIcon && "pl-10",
                    error && "border-red-400 focus:border-red-500 focus:ring-red-500",
                    className
                )}
                {...props}
            />
        );

        if (!leadingIcon) {
            return inputElement;
        }

        return (
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    {leadingIcon}
                </div>
                {inputElement}
            </div>
        );
    }
);

Input.displayName = "Input";
