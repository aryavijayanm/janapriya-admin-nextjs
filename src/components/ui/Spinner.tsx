import { cn } from "@/lib/cn";

interface SpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps["size"]>, string> = {
    sm: "h-4 w-4 border-2",
    md: "h-5 w-5 border-2",
    lg: "h-8 w-8 border-[3px]",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className={cn(
                "inline-block animate-spin rounded-full border-current border-t-transparent",
                sizeClasses[size],
                className
            )}
        />
    );
}
