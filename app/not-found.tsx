/**
 * @file app/not-found.tsx
 * @description The custom 404 error page for the application.
 * This is displayed when a user navigates to a non-existent route.
 */

import Link from "next/link"
import { Button } from "@/components/ui/button" // Reusable UI button component from shadcn/ui
import { IconHome, IconArrowLeft } from "@tabler/icons-react" // Icons from Tabler library

/**
 * NotFound Component
 * @returns A visually appealing 404 error page with navigation options.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center selection:bg-primary selection:text-primary-foreground">
      {/* 
        Big Background Text: Large '404' watermark behind the main message.
      */}
      <div className="relative mb-4 flex items-center justify-center">
        <h1 className="text-[12rem] md:text-[16rem] font-black text-primary/5 select-none leading-none">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center pt-8">
          <p className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            Lost in Communication?
          </p>
        </div>
      </div>

      {/* Subtext explaining the error with a nod to the app's theme (voice/communication) */}
      <p className="max-w-md text-muted-foreground mb-12 text-lg">
        The page you&apos;re looking for seems to have been lost in translation.
        Don&apos;t worry, your voice is still powerful. Let&apos;s get you back
        on track.
      </p>

      {/* Primary Navigation Options */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Button to go back to the landing page */}
        <Button asChild size="lg" className="h-12 px-8">
          <Link href="/">
            <IconHome className="mr-2 size-5" />
            Back to Home
          </Link>
        </Button>
        {/* Button to go to the user's progress page, suggesting an alternative path */}
        <Button asChild variant="outline" size="lg" className="h-12 px-8 group">
          <Link href="/progress">
            <IconArrowLeft className="mr-2 size-5 transition-transform group-hover:-translate-x-1" />
            Go to Progress
          </Link>
        </Button>
      </div>

      {/* 
        Modern Background Accents: 
        Decorative blurred circles to create a premium "glassmorphism" look.
      */}
      <div className="fixed top-0 left-0 -z-10 h-full w-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>
    </div>
  )
}
