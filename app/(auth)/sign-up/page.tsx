/**
 * @file app/(auth)/sign-up/page.tsx
 * @description The Sign Up page for the application.
 * Features a split-screen layout on large screens with the signup form and an aesthetic background image.
 */

import { SignUpForm } from "@/components/auth/signup-form" // The actual registration form logic
import { Logo } from "@/components/layout/logo" // The application logo
import Image from "next/image" // Next.js optimized image component

/**
 * SignUpPage Component
 * @returns The sign-up page with a responsive layout.
 */
export default function SignUpPage() {
  return (
    /**
     * Grid Container
     * min-h-svh: Full viewport height (Small Viewport Height)
     * lg:grid-cols-2: Two Column layout on desktop (Left: Image, Right: Form)
     */
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column (Desktop only) - Aesthetic Background */}
      <div className="bg-muted relative hidden lg:block border-r border-white/5">
        {/* Background Image with optimized loading */}
        <Image
          src="/signup-bg.png"
          alt="Sign Up Background"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4]"
          priority
        />
        {/* Dark gradient overlay to improve contrast and aesthetic depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Right Column (or full width on mobile) - Form Area */}
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
    </div>
  )
}
