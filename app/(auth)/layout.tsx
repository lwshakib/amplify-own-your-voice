/**
 * @file app/(auth)/layout.tsx
 * @description Shared layout for all authentication pages.
 * Handles the unified background, forces dark theme styles, and hosts the persistent
 * AuthVisual soundwave component on the right side to prevent visual flashes during navigation.
 */

import { AuthVisual } from "@/components/auth/auth-visual"

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    /**
     * Auth Layout Grid
     * Force the 'dark' theme context and 'bg-zinc-950' background color across both columns.
     * This creates a unified dark background spanning the entire viewport.
     */
    <div className="dark grid min-h-svh lg:grid-cols-2 bg-zinc-950 text-white antialiased">
      {/* Left Column (Desktop only) - Persistent Visual Soundwave */}
      <div className="relative hidden lg:block bg-zinc-950">
        <AuthVisual />
      </div>

      {/* Right Column - Dynamic Auth Forms (Sign In, Sign Up, etc.) */}
      <div className="flex flex-col min-h-svh">{children}</div>
    </div>
  )
}
