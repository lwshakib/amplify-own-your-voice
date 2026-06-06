/**
 * @file app/(auth)/reset-password/page.tsx
 * @description The Reset Password page for the application.
 * Returns only the form column to be rendered inside the shared auth grid layout.
 */

import { Suspense } from "react" // For handling asynchronous loading of the form components
import { ResetPasswordForm } from "@/components/auth/reset-password-form" // The form to set a new password
import { Logo } from "@/components/layout/logo" // Application logo
import { Loader2 } from "lucide-react" // Loading spinner icon

/**
 * ResetPasswordPage Component
 * @returns The reset password form column.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col flex-1 gap-4 p-6 md:p-10">
      {/* Top area for the Logo */}
      <div className="flex justify-center gap-2 md:justify-start">
        <Logo />
      </div>

      {/* Centered container for the reset password form */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md">
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="size-12 animate-spin text-primary" />
                <h1 className="text-2xl font-bold">Loading...</h1>
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
