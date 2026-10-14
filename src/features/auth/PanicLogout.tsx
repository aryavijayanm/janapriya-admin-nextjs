"use client";

import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/features/auth/auth.actions";

const TAP_WINDOW_MS = 800;
const TAPS_REQUIRED = 2;

// Trigger: 2 standalone Ctrl taps (pressed and released with no other key
// touched while held) within TAP_WINDOW_MS, anywhere in the app.
//
// Only mounted inside DashboardLayout, so it exists only while someone is
// logged in -- no "is there a user?" check needed, unlike the old version.
export function PanicLogout() {
    const [hidden, setHidden] = useState(false);
    const disqualifiedRef = useRef(false);
    const tapTimestampsRef = useRef<number[]>([]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key !== "Control") {
                // Some other key is held alongside Ctrl -- this hold is a
                // real combo (Ctrl+C, Ctrl+V, ...), not a lone tap.
                disqualifiedRef.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key !== "Control") return;

            const wasClean = !disqualifiedRef.current;
            disqualifiedRef.current = false;
            if (!wasClean) return;

            const now = Date.now();
            const recentTaps = tapTimestampsRef.current.filter((t) => now - t < TAP_WINDOW_MS);
            recentTaps.push(now);
            tapTimestampsRef.current = recentTaps;

            if (recentTaps.length >= TAPS_REQUIRED) {
                tapTimestampsRef.current = [];
                // Blank the screen instantly, before the network round trip...
                setHidden(true);
                // ...then delete the session on the server and redirect to /login.
                // Unlike the old cookie-only logout, a copied cookie dies too.
                void logoutAction();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    return hidden ? <div className="fixed inset-0 z-100 bg-white" aria-hidden="true" /> : null;
}
