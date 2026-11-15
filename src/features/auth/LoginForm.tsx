"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { loginAction, type LoginState } from "@/features/auth/auth.actions";

const initialState: LoginState = { error: null };

// Shared by both inputs. Kept as the old login page's own larger style
// (rounded-xl, py-3, pl-12) rather than the generic <Input> component, which
// is smaller -- this page's look is deliberately its own.
// Frosted to match the glass box: 60% white with a white edge, turning
// solid white while typing so the text is crisp.
const inputClass =
    "block w-full pl-12 py-3 border border-white/70 rounded-xl leading-5 bg-white/60 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all text-black";

export function LoginForm() {
    // useActionState replaces the old hand-rolled trio of
    // useState(error) + useState(isSubmitting) + try/catch/finally:
    //   state      -- whatever the action last returned (here: an error message)
    //   formAction -- pass to <form action>; React calls the Server Action with the FormData
    //   isPending  -- true while the action runs, drives the button spinner
    const [state, formAction, isPending] = useActionState(loginAction, initialState);

    const [showPassword, setShowPassword] = useState(false);
    // Controlled, like the old page, so a failed attempt keeps what was typed
    // instead of React clearing the form after the action finishes.
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    return (
        // No background here: the page behind it (login/page.tsx) paints the
        // gradient and colour glows. "relative" keeps this above them.
        <div className="relative min-h-screen flex items-center justify-center px-4 py-8">
            {/* The glass box ("glassmorphism"):
                  bg-white/45        see-through white, so the glows show through
                  backdrop-blur-xl   blurs whatever is behind it -> frosted glass
                  border-white/70    a bright edge, like light catching glass
                  shadow tinted plum so it feels part of the palette, not gray
                p-6 on phones, p-8 from sm: up -- the 288px logo plus p-8 padding
                only just fits a 390px screen otherwise. */}
            <div className="max-w-md w-full space-y-8 rounded-3xl border border-white/70 bg-white/45 p-6 shadow-2xl shadow-brand-plum/15 backdrop-blur-xl sm:p-8 motion-safe:animate-modal-in">
                {/* Logo */}
                <div className="flex flex-col items-center">
                    <div className="relative w-72 h-36 mb-2 max-w-full">
                        <Image
                            src="/images/logo.png"
                            alt="Janapriya Logo"
                            fill
                            // The box is w-72 (288px): tells the browser which image size to fetch.
                            sizes="288px"
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                <p className="-mt-4 text-center text-sm text-gray-600">Welcome back! Please log in to continue.</p>

                <form className="mt-8 space-y-6" action={formAction}>
                    {state.error && <Alert variant="error">{state.error}</Alert>}

                    <div className="space-y-4">
                        {/* Username */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Username
                            </label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserRound className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    autoComplete="off"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className={`${inputClass} pr-3`}
                                    placeholder="Enter your username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`${inputClass} pr-12`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((value) => !value)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        isLoading={isPending}
                        // The logo's pink -> purple sweep (same pair as the sidebar's
                        // active item). The gradient paints over the button's flat
                        // pink; on hover it glows a little stronger.
                        className="w-full rounded-xl py-3 bg-linear-to-r from-primary to-primary-end shadow-lg shadow-brand-pink/30 hover:shadow-xl hover:shadow-brand-pink/40"
                    >
                        Login
                    </Button>
                </form>
            </div>
        </div>
    );
}
