/**
 * @file app/(auth)/sign-in/page.tsx
 * @description The Sign In page for the application.
 * Returns only the form column to be rendered inside the shared auth grid layout.
 */

import { LoginForm } from "@/components/auth/login-form" // The actual authentication form logic
import { Logo } from "@/components/layout/logo" // The application logo

/**
 * SignInPage Component
 * @returns The sign-in form column.
 */
export default function SignInPage() {
  return (
    <div className="flex flex-col flex-1 gap-4 p-6 md:p-10">
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
  )
}
