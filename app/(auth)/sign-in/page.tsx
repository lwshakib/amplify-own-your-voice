/**
 * @file app/(auth)/sign-in/page.tsx
 * @description The Sign In page for the application.
 * Features a split-screen layout on large screens with the login form and an aesthetic background image.
 */

import { LoginForm } from "@/components/auth/login-form" // The actual authentication form logic
import { Logo } from "@/components/layout/logo" // The application logo
import Image from "next/image" // Next.js optimized image component

/**
 * SignInPage Component
 * @returns The sign-in page with a responsive layout.
 */
export default function SignInPage() {
  return (
    /**
     * Grid Container
     * min-h-svh: Full viewport height (Small Viewport Height)
     * lg:grid-cols-2: Two Column layout on desktop (Left: Form, Right: Image)
     */
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column (or full width on mobile) - Form Area */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Top area for the Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>

        {/* Centered container for the login form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right Column (Desktop only) - Aesthetic Background */}
      <div className="bg-muted relative hidden lg:block border-l border-white/5">
        {/* Background Image with optimized loading */}
        <Image
          src="/signin-bg.png"
          alt="Sign In Background"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4]"
          priority
        />
        {/* Dark gradient overlay to improve contrast and aesthetic depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    </div>
  )
}
