"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function VerifyEmailContent() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="size-6 text-primary" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Email verified!</h1>
          <p className="text-muted-foreground text-sm text-balance max-w-sm">
            Your email has been verified successfully. You can now log in to
            your account.
          </p>
        </div>
        <Button onClick={() => router.push("/sign-in")} className="w-full">
          Back to login
        </Button>
      </div>
    </div>
  )
}

export function VerifyEmailView({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("w-full max-w-md mx-auto", className)} {...props}>
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="size-12 animate-spin text-primary" />
            <h1 className="text-2xl font-bold">Loading...</h1>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
