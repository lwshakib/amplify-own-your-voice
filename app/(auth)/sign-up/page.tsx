/**
 * @file app/(auth)/sign-up/page.tsx
 * @description The Sign Up page for the application.
 * Returns only the form column to be rendered inside the shared auth grid layout.
 */

import { SignUpForm } from "@/components/auth/signup-form" // The actual registration form logic

/**
 * SignUpPage Component
 * @returns The sign-up form column.
 */
export default function SignUpPage() {
  return (
    <div className="flex flex-col flex-1 gap-4 p-6 md:p-10 justify-center">
      {/* Centered container for the sign-up form */}
      <div className="flex items-center justify-center">
        <div className="w-full max-w-md">
          <SignUpForm />
        </div>
      </div>
    </div>
  )
}
