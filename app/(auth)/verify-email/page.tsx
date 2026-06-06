/**
 * @file app/(auth)/verify-email/page.tsx
 * @description The Email Verification page.
 * Returns only the verification content column to be rendered inside the shared auth grid layout.
 */

import { VerifyEmailView } from "@/components/auth/verify-email-view" // Component that handles the verification logic and UI

/**
 * VerifyEmailPage Component
 * @returns The email verification column.
 */
export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col flex-1 gap-4 p-6 md:p-10 justify-center">
      {/* Centered container for the verification view */}
      <div className="flex items-center justify-center">
        <div className="w-full max-w-md">
          <VerifyEmailView />
        </div>
      </div>
    </div>
  )
}
