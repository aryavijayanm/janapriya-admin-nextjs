import { ReactNode } from "react";

interface FormFieldProps {
    label: string;
    htmlFor: string;
    error?: string;
    children: ReactNode;
}

// The single place label + error styling is defined for every field in every form.
// Reuses the .label utility class already defined in globals.css.
export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
    return (
        <div>
            <label htmlFor={htmlFor} className="label">
                {label}
            </label>
            {children}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}
