"use client"

/**
 * @file app/(auth)/login/page.tsx
 * @description The unified authentication entry page.
 * Uses Google OAuth as the sole identity provider and presents a clean, minimal layout
 * with standard terms & policy notes.
 */

import { useState } from "react"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  /**
   * Handle Google OAuth Sign-in
   * Redirects user to Google sign-in consent, callback to /progress on success
   */
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/progress",
      })
    } catch (error) {
      console.error("Google sign in error:", error)
      toast.error("Failed to authenticate with Google. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 gap-6 p-6 md:p-10 justify-center">
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-8 text-center">
          {/* Header */}
          <div className="space-y-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome to Amplify
            </h1>
            <p className="text-xs text-zinc-400 max-w-[280px] mx-auto text-balance leading-normal">
              Elevate your speech and interviews. Continue with Google to access
              your dashboard.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Button
              variant="outline"
              type="button"
              className="w-full h-12 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              disabled={isLoading}
              onClick={handleGoogleLogin}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin text-zinc-400" />
              ) : (
                <Image
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google"
                  className="size-4"
                  width={16}
                  height={16}
                />
              )}
              <span>Continue with Google</span>
            </Button>
          </div>

          {/* Subtle Legal Footer */}
          <div className="pt-4 space-y-1">
            <p className="text-[10px] text-zinc-500 max-w-[260px] mx-auto leading-normal">
              By continuing, you agree to our{" "}
              <a
                href="#"
                className="underline hover:text-zinc-400 transition-colors"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="underline hover:text-zinc-400 transition-colors"
              >
                Privacy Policy
              </a>
              .
            </p>
            <p className="text-[9px] text-zinc-600">
              Secured with decentralized authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
