/**
 * @file app/(auth)/forgot-password/page.tsx
 * @description The Forgot Password page for the application.
 * Allows users to request a password reset link via email.
 * Uses a split-screen layout similar to Sign In/Sign Up.
 */

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form" // The form to handle password reset requests
import { Logo } from "@/components/layout/logo" // The application logo
import Image from "next/image" // Next.js optimized image component

/**
 * ForgotPasswordPage Component
 * @returns The password recovery page with a responsive layout.
 */
export default function ForgotPasswordPage() {
  return (
    /**
     * Grid Container
     * min-h-svh: Full viewport height
     * lg:grid-cols-2: Two Column layout on desktop (Left: Image, Right: Form)
     */
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column (Desktop only) - Aesthetic Background */}
      <div className="bg-muted relative hidden lg:block border-r border-white/5">
        {/* Background Image reused from sign-up for consistency */}
        <Image
          src="/signup-bg.png"
          alt="Password Recovery Background"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4]"
          priority
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Right Column (or full width on mobile) - Form Area */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Top area for the Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>

        {/* Centered container for the forgot password form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  )
}
