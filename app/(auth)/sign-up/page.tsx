/**
 * @file app/(auth)/sign-up/page.tsx
 * @description The Sign Up page for the application.
 * Returns only the form column to be rendered inside the shared auth grid layout.
 */

import { SignUpForm } from "@/components/auth/signup-form" // The actual registration form logic
import { Logo } from "@/components/layout/logo" // The application logo

/**
 * SignUpPage Component
 * @returns The sign-up form column.
 */
export default function SignUpPage() {
  return (
    <div className="flex flex-col flex-1 gap-4 p-6 md:p-10">
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
  )
}
