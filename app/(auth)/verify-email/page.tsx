/**
 * @file app/(auth)/verify-email/page.tsx
 * @description The Email Verification page.
 * Users land here to confirm their email address after registration.
 * Uses a consistent split-screen layout.
 */

import { VerifyEmailView } from "@/components/auth/verify-email-view" // Component that handles the verification logic and UI
import { Logo } from "@/components/layout/logo" // Application logo
import { AuthVisual } from "@/components/auth/auth-visual"

/**
 * VerifyEmailPage Component
 * @returns The email verification page with a responsive layout.
 */
export default function VerifyEmailPage() {
  return (
    /**
     * Grid Container
     * min-h-svh: Full viewport height
     * lg:grid-cols-2: Two Column layout on desktop (Left: Content, Right: Visual Web)
     */
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column (or full width on mobile) - Verification Content */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Top area for the Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>

        {/* Centered container for the verification view */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <VerifyEmailView />
          </div>
        </div>
      </div>

      {/* Right Column (Desktop only) - Aesthetic Background */}
      <div className="relative hidden lg:block border-l border-white/5">
        <AuthVisual />
      </div>
    </div>
  )
}
