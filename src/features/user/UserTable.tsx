"use client";

import { useState } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { UserFormModal } from "@/features/user/UserFormModal";
import { setUserActiveAction } from "@/features/user/user.actions";
import type { UserListItem } from "@/server/services/user.service";

interface UserTableProps {
    users: UserListItem[];
    // Used only to hide the Disable button on your own row. The real rule
    // ("you cannot disable yourself") is enforced in the service.
    currentUserId: number;
}

// The old version fetched its own data in a useEffect and kept users /
// isLoading / loadUsers() in state. Now the page (a Server Component) fetches
// and passes `users` in. After any change, the Server Action calls
// revalidatePath("/users"), Next.js re-renders the page on the server, and
// fresh `users` arrive here as new props -- no manual reload function.
export default function UserTable({ users, currentUserId }: UserTableProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
    // Which row's Enable/Disable is in flight, so only that button spins.
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [error, setError] = useState("");

    const handleToggleActive = async (user: UserListItem) => {
        setTogglingId(user.id);
        setError("");
        try {
            const result = await setUserActiveAction(user.id, !user.is_active);
            if (!result.ok) setError(result.error);
        } finally {
            setTogglingId(null);
        }
    };

    const handleAdd = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const handleEdit = (user: UserListItem) => {
        setEditingUser(user);
        setModalOpen(true);
    };

    const columns: TableColumn<UserListItem>[] = [
        { header: "Name", accessor: "name" },
        { header: "Username", accessor: "username" },
        { header: "Designation", accessor: (u) => u.designation ?? "—" },
        { header: "Role", accessor: "role" },
        {
            header: "Status",
            accessor: (user) => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.is_active ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}
                >
                    {user.is_active ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            header: "Actions",
            accessor: (user) => (
                <div className="flex gap-2">
                    {/* No Disable button on your own row -- the service refuses it anyway. */}
                    {user.id !== currentUserId && (
                        <Button
                            size="sm"
                            variant={user.is_active ? "disable" : "enable"}
                            onClick={() => handleToggleActive(user)}
                            isLoading={togglingId === user.id}
                        >
                            {user.is_active ? "Disable" : "Enable"}
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(user)}>
                        Edit
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            {/* p-4 on phones, p-8 from sm: up -- same look on a laptop. */}
            <div className="max-w-5xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Manage Users</h2>

                {error && <Alert variant="error" className="mb-4">{error}</Alert>}

                <Table
                    columns={columns}
                    data={users}
                    getRowKey={(u) => u.id}
                    emptyMessage="No users yet."
                />
                <div className="mt-4">
                    <Button onClick={handleAdd}>+ Add User</Button>
                </div>
            </div>

            {/* Rendered only while open, and keyed by the user being edited, so
                the form starts fresh on every open from its initial props. The
                old version re-synced the form with a useEffect instead, which
                the current React lint rules flag as an anti-pattern. */}
            {modalOpen && (
                <UserFormModal
                    key={editingUser?.id ?? "new"}
                    user={editingUser}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}
