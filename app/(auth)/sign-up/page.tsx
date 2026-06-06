/**
 * @file app/(auth)/sign-up/page.tsx
 * @description The Sign Up page for the application.
 * Features a split-screen layout on large screens with the signup form and an aesthetic background image.
 */

import { SignUpForm } from "@/components/auth/signup-form" // The actual registration form logic
import { Logo } from "@/components/layout/logo" // The application logo
import { AuthVisual } from "@/components/auth/auth-visual"

/**
 * SignUpPage Component
 * @returns The sign-up page with a responsive layout.
 */
export default function SignUpPage() {
  return (
    /**
     * Grid Container
     * min-h-svh: Full viewport height (Small Viewport Height)
     * lg:grid-cols-2: Two Column layout on desktop (Left: Form, Right: Visual Web)
     */
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column (or full width on mobile) - Form Area */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Top area for the Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>

        {/* Centered container for the sign-up form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <SignUpForm />
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
