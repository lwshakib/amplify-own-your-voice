/**
 * @file app/(auth)/reset-password/page.tsx
 * @description The Reset Password page for the application.
 * Users land here after clicking a link in their recovery email.
 * Includes a Suspense wrapper for the form as it may depend on URL parameters.
 */

import { Suspense } from "react" // For handling asynchronous loading of the form components
import { ResetPasswordForm } from "@/components/auth/reset-password-form" // The form to set a new password
import { Logo } from "@/components/layout/logo" // Application logo
import { Loader2 } from "lucide-react" // Loading spinner icon
import Image from "next/image" // Optimized image component

/**
 * ResetPasswordPage Component
 * @returns The password reset page with a responsive split layout.
 */
export default function ResetPasswordPage() {
  return (
    /**
     * Grid Container
     * min-h-svh: Full viewport height
     * lg:grid-cols-2: Two Column layout on desktop (Left: Image, Right: FormArea)
     */
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column (Desktop only) - Aesthetic Background */}
      <div className="bg-muted relative hidden lg:block border-r border-white/5">
        <Image
          src="/signup-bg.png"
          alt="Reset Password Background"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Right Column (or full width on mobile) - Form Area */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Top area for the Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>

        {/* Centered container for the reset password form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            {/* 
              Suspense: Wraps the ResetPasswordForm because it typically uses 
              useSearchParams() which requires a Suspense boundary in Next.js 14+ 
            */}
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
    </div>
  )
}
