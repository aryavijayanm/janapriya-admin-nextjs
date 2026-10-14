"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createServiceAction, updateServiceAction } from "@/features/service/service.actions";
import { serviceSchema } from "@/server/validators/service";
import type { Service } from "@prisma/client";

interface ServiceFormModalProps {
    // Presence of a service means "editing that service"; absence means "creating a new one" --
    // one modal, two thin modes, instead of two near-identical components.
    service: Service | null;
    onClose: () => void;
}

export function ServiceFormModal({ service, onClose }: ServiceFormModalProps) {
    const isEditing = !!service;
    const [name, setName] = useState(service?.name ?? "");
    const [abbreviation, setAbbreviation] = useState(service?.abbreviation ?? "");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Same schema the server uses -- replaces the old hand-written
        // "Service name is required." / "Abbreviation is required." checks.
        const payload = { name, abbreviation };
        const check = serviceSchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = isEditing
                ? await updateServiceAction(service.id, payload)
                : await createServiceAction(payload);

            if (result.ok) {
                onClose();
            } else {
                setError(result.error);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title={isEditing ? "Edit Service" : "Add Service"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Service name" htmlFor="service-name">
                    <Input
                        id="service-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Baby Care"
                        autoFocus
                    />
                </FormField>
                <FormField label="Abbreviation" htmlFor="service-abbreviation">
                    <Input
                        id="service-abbreviation"
                        value={abbreviation}
                        // Shown in uppercase as you type -- matches what will be saved,
                        // since the schema uppercases it anyway.
                        onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                        placeholder="e.g. BC"
                    />
                </FormField>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {isEditing ? "Save" : "Add"}
                    </Button>
                </div>

                {/* After the submit button, not before -- consistent with the
                    same convention across every form in this project. */}
                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
