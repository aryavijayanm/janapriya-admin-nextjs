"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createUserAction, updateUserAction } from "@/features/user/user.actions";
import { ROLES, createUserSchema, updateUserSchema } from "@/server/validators/user";
import type { UserListItem } from "@/server/services/user.service";

interface UserFormModalProps {
    // Presence of a user means "editing that user" -- only name, designation,
    // and password are editable, even by an Owner (username and role are
    // fixed at creation and never change afterward). Absence means "creating
    // a new one," which additionally needs username + role.
    user: UserListItem | null;
    onClose: () => void;
}

export function UserFormModal({ user, onClose }: UserFormModalProps) {
    const isEditing = !!user;

    // Initialised straight from props. The parent mounts this component fresh
    // on every open (see the `key` in UserTable), so no syncing effect is needed.
    const [form, setForm] = useState({
        name: user?.name ?? "",
        username: "",
        password: "",
        confirmPassword: "",
        designation: user?.designation ?? "",
        role: "",
    });
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Browser-only check: the server never sees the second copy.
        if (form.password && form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        // The SAME schema the server validates with, so the two sides can't
        // disagree. The server still validates again -- anyone can call the
        // action without this form, so this check is a convenience, not security.
        const payload = isEditing
            ? {
                name: form.name,
                designation: form.designation,
                // Blank means "keep the current password" -- send nothing.
                ...(form.password ? { password: form.password } : {}),
            }
            : {
                name: form.name,
                username: form.username,
                password: form.password,
                designation: form.designation,
                role: form.role,
            };

        const check = (isEditing ? updateUserSchema : createUserSchema).safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = isEditing
                ? await updateUserAction(user.id, payload)
                : await createUserAction(payload);

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
        <Modal isOpen onClose={onClose} title={isEditing ? "Edit User" : "Add User"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Name" htmlFor="name">
                    <Input id="name" name="name" value={form.name} onChange={handleChange} autoComplete="off" />
                </FormField>

                {!isEditing && (
                    <FormField label="Username" htmlFor="username">
                        <Input id="username" name="username" value={form.username} onChange={handleChange} autoComplete="off" />
                    </FormField>
                )}

                <FormField label="Designation" htmlFor="designation">
                    <Input id="designation" name="designation" value={form.designation} onChange={handleChange} />
                </FormField>

                {!isEditing && (
                    <FormField label="Role" htmlFor="role">
                        <Select id="role" name="role" value={form.role} onChange={handleChange}>
                            <option value="" disabled>Select a role</option>
                            {/* Same list the server validates against -- one source. */}
                            {ROLES.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </Select>
                    </FormField>
                )}

                <FormField
                    label={isEditing ? "New password (leave blank to keep unchanged)" : "Password"}
                    htmlFor="password"
                >
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                    />
                </FormField>

                {(isEditing ? form.password : true) && (
                    <FormField label="Confirm password" htmlFor="confirmPassword">
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            autoComplete="new-password"
                        />
                    </FormField>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {isEditing ? "Save" : "Add"}
                    </Button>
                </div>

                {/* After the submit button, not before -- stays visible without
                    scrolling back up once the form grows past one screen. */}
                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
