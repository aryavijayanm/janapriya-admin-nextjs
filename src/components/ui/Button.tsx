import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "enable" | "disable" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
}

// One class-string per variant/size, defined once here. Any call site picks a
// `variant`/`size` instead of writing its own colors — see globals.css .btn-primary,
// which this "primary" variant mirrors so the two stay visually identical.
const variantClasses: Record<ButtonVariant, string> = {
    primary:
        "bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary",
    secondary:
        "bg-gray-200 text-gray-800 hover:bg-gray-300 focus-visible:ring-gray-400",
    danger:
        "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
    success:
        "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500",
    // The enable/disable toggle, everywhere -- same logo pink/purple pairing
    // as "accent" was, but now two distinct weightings so the two opposite
    // actions read as visually different, not just a relabeled button:
    // purple dominant when the action is "turn it on", pink dominant when
    // the action is "turn it off". The `via` stop is what biases the ratio --
    // without it a 2-color gradient reads as a flat ~50/50 split regardless.
    enable:
        "bg-gradient-to-r from-purple-700 via-purple-600 to-pink-500 text-white hover:opacity-90 focus-visible:ring-purple-500",
    disable:
        "bg-gradient-to-r from-pink-700 via-pink-600 to-purple-500 text-white hover:opacity-90 focus-visible:ring-pink-500",
    ghost:
        "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-300",
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = "primary",
            size = "md",
            isLoading = false,
            disabled,
            className,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg font-medium shadow-sm transition-all duration-200",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                {isLoading && <Spinner size="sm" />}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
