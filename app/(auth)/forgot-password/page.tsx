/**
 * @file app/(auth)/forgot-password/page.tsx
 * @description The Forgot Password page for the application.
 * Returns only the form column to be rendered inside the shared auth grid layout.
 */

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form" // The form to handle password reset requests
import { Logo } from "@/components/layout/logo" // The application logo

/**
 * ForgotPasswordPage Component
 * @returns The forgot password form column.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col flex-1 gap-4 p-6 md:p-10">
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
  )
}
