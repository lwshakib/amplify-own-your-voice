/**
 * @file app/(main)/sessions/new/page.tsx
 * @description The 'Preparation' page for a new AI practice session.
 * This page serves as a gateway where users review a selected template (IELTS, General, or Technical)
 * before the system initializes the interview context and the active session.
 */

"use client"

import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useState, Suspense } from "react"
import {
  IconPlayerPlay,
  IconInfoCircle,
  IconLoader2,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

/**
 * Predefined session templates.
 * These are used to prepopulate the interview configuration when a user starts a standard session.
 * Each template defines the 'parts' which will be handled by the AI interviewer.
 */
const templates = {
  ielts: {
    title: "IELTS Speaking Mock",
    description:
      "A full-length IELTS Speaking test simulation. Covers Part 1 (Introduction), Part 2 (Cue Card), and Part 3 (Discussion). Practice fluency, vocabulary, and coherence.",
    category: "Standardized Test",
    duration: "11-14 minutes",
    parts: [
      {
        title: "Part 1: Introduction",
        description:
          "General questions about yourself, home, family, job, studies, and interests.",
        duration: "4-5 minutes",
      },
      {
        title: "Part 2: Cue Card",
        description:
          "You will be given a topic card and have 1 minute to prepare before speaking for up to 2 minutes.",
        duration: "3-4 minutes",
      },
      {
        title: "Part 3: Discussion",
        description:
          "Deeper questions related to the topic in Part 2, requiring abstract ideas and detailed explanations.",
        duration: "4-5 minutes",
      },
    ],
  },
  general: {
    title: "General Interview",
    description:
      "Common behavioral and situational questions asked in most job interviews. Focuses on soft skills, past experiences, and cultural fit.",
    category: "Behavioral",
    duration: "15-20 minutes",
    parts: [
      {
        title: "Introduction",
        description: "Tell me about yourself and your background.",
        duration: "2-3 minutes",
      },
      {
        title: "Behavioral Questions",
        description: "STAR method questions (Situation, Task, Action, Result).",
        duration: "10-12 minutes",
      },
      {
        title: "Closing",
        description: "Opportunity for you to ask questions.",
        duration: "2-3 minutes",
      },
    ],
  },
  tech: {
    title: "Technical Interview",
    description:
      "Coding challenges and system design discussions. Geared towards Software Engineering roles. Includes live coding environment.",
    category: "Technical",
    duration: "30-45 minutes",
    parts: [
      {
        title: "Concept Check",
        description: "Rapid fire questions on core CS concepts.",
        duration: "5-10 minutes",
      },
      {
        title: "Coding Challenge",
        description: "Solve a problem using the integrated code editor.",
        duration: "20-30 minutes",
      },
      {
        title: "Optimization",
        description:
          "Discuss time/space complexity and potential improvements.",
        duration: "5 minutes",
      },
    ],
  },
}

/**
 * NewSessionContent Component
 * Responsible for rendering the template preview and handling the 'Start' trigger.
 */
function NewSessionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Extract template type from URL. Default to 'general' if missing or invalid.
  const type = (searchParams.get("type") as keyof typeof templates) || "general"
  const template = templates[type] || templates.general

  const [isLoading, setIsLoading] = useState(false)

  /**
   * Initializes a new practice session via a multi-step API flow.
   * 1. Creates an 'Interview' (the configuration/context).
   * 2. Creates a 'Session' (the actual active practice instance).
   * 3. Navigates to the live runner UI.
   */
  const handleStartSession = async () => {
    setIsLoading(true)
    const toastId = toast.loading("Initializing practice session...")

    try {
      // Step 1: Create the interview record (The "What")
      const interviewRes = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: template.title,
          description: template.description,
          type: type === "tech" ? "Technical" : "Behavioral",
          // No aiCharacterId specified here defaults to the system default character
        }),
      })

      if (!interviewRes.ok) throw new Error("Failed to create interview")
      const interview = await interviewRes.json()

      // Step 2: Create the active session record (The "When/Current")
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: interview.id }),
      })

      if (!sessionRes.ok) throw new Error("Failed to start session")
      const session = await sessionRes.json()

      toast.success("Ready! Starting session...", { id: toastId })

      // Step 3: Redirect to the live execution page
      router.push(`/sessions/${session.id}/run`)
    } catch (error) {
      console.error("Initialization error:", error)
      toast.error("Failed to start session. Please try again.", { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center items-center p-8 min-h-[calc(100vh-4rem)]">
      {/* Visual Preview of the Selected Template */}
      <Card className="w-full max-w-3xl relative overflow-hidden border-primary/10 bg-card/60 backdrop-blur-md shadow-2xl">
        {/* Decorative Background Glow Effect */}
        <div className="absolute top-0 right-0 p-40 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <CardHeader className="pb-8 border-b border-border/40 space-y-6">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="uppercase tracking-widest text-[10px] py-1 px-3 border-primary/20 text-primary"
            >
              {template.category}
            </Badge>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
              <IconInfoCircle className="size-3.5" />
              {template.duration}
            </div>
          </div>

          <div className="space-y-4">
            <CardTitle className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              {template.title}
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              {template.description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-8 space-y-8">
          {/* Section: Preparation breakdown */}
          <div className="grid gap-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Session Breakdown
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {template.parts?.map((part, i) => (
                <div
                  key={i}
                  className="group p-4 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                      {part.duration}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{part.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {part.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action: Start the session */}
          <div className="flex flex-col gap-4 items-center pt-8">
            <Button
              size="lg"
              className="w-full sm:w-auto min-w-[200px] text-base font-bold uppercase tracking-wide h-14 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              onClick={handleStartSession}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 className="size-4 animate-spin" />
                  Initializing...
                </span>
              ) : (
                <>
                  Start Now
                  <IconPlayerPlay className="ml-2 size-5 fill-current" />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Ensure you are in a quiet environment. Your voice will be
              processed by AI for real-time analysis and feedback.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Main Page Component
 * @description Wrapped in Suspense because `useSearchParams` triggers client-side navigation features
 * that can cause hydration mismatches if not handled during SSR.
 */
export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <IconLoader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <NewSessionContent />
    </Suspense>
  )
}
