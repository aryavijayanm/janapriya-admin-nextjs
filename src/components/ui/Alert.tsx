import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "success" | "error" | "info";

interface AlertProps {
    variant?: AlertVariant;
    children: ReactNode;
    className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
    success: "bg-green-50 border-green-300 text-green-700",
    error: "bg-red-50 border-red-300 text-red-600",
    info: "bg-blue-50 border-blue-300 text-blue-700",
};

export function Alert({ variant = "info", children, className }: AlertProps) {
    return (
        <div
            role="alert"
            className={cn(
                "rounded-lg border px-4 py-3 text-sm font-medium",
                variantClasses[variant],
                className
            )}
        >
            {children}
        </div>
    );
}
