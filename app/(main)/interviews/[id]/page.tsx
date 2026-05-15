/**
 * @file app/(main)/interviews/[id]/page.tsx
 * @description The Interview detail page.
 * Displays the specific job title, description (rendered via Markdown),
 * and the assigned AI Interviewer for a particular setup.
 */

"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { IconArrowLeft, IconPlayerPlay, IconEdit } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EditInterviewModal } from "@/components/modals/edit-interview-modal"
import { formatDistanceToNow } from "date-fns"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { INTERVIEW_TYPE_LABELS } from "@/lib/constants"
import { getCharacter } from "@/lib/characters" // Helper to resolve AI character ID to metadata
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * Interview Interface
 * Structure for the interview configuration data.
 */
interface Interview {
  id: string
  jobTitle: string
  description: string
  createdAt: string
  type: string
  characterId: string | null
}

/**
 * InterviewDetailsPage Component
 * @param params - Contains the unique interview ID.
 */
export default function InterviewDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  /**
   * Fetches the specific interview configuration.
   */
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await fetch(`/api/interviews/${id}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setInterview(data)
      } catch (error) {
        console.error("Error fetching interview details:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchInterview()
  }, [id])

  /**
   * Transitions from a static definition to a live session.
   * This creates a new 'interaction' record in the database.
   */
  const handleStartSession = async () => {
    setIsStarting(true)
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id }),
      })

      if (!response.ok) throw new Error("Failed to start session")

      const session = await response.json()
      // Go to the live interaction UI
      router.push(`/sessions/${session.id}/run`)
    } catch (error) {
      console.error("Error starting interview session:", error)
      alert("Failed to start session. Please try again.")
    } finally {
      setIsStarting(false)
    }
  }

  // Loading and Not Found fallbacks
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading interview details...</p>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Interview not found</p>
        <Link href="/interviews">
          <Button variant="outline">Back to Interviews</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Header Section: Back button, Interviewer Avatar, Title and Stats */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <Link href="/interviews" className="mt-1 lg:mt-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-muted shrink-0"
              >
                <IconArrowLeft className="size-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-4 min-w-0">
              {/* Resolve showing the AI character chosen for this interview */}
              {interview.characterId && (
                <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-muted/50 shrink-0">
                  <AvatarImage
                    src={getCharacter(interview.characterId)?.avatar}
                    alt={getCharacter(interview.characterId)?.firstName}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                    {getCharacter(interview.characterId)?.firstName?.[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight truncate sm:whitespace-normal">
                  {interview.jobTitle}
                </h1>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2">
                  <span className="text-sm text-muted-foreground font-medium">
                    Created{" "}
                    {formatDistanceToNow(new Date(interview.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <div className="hidden sm:block h-3 w-px bg-muted" />
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20 px-2 py-0.5"
                  >
                    {INTERVIEW_TYPE_LABELS[interview.type] || interview.type}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Core Actions: Edit and Start */}
          <div className="flex items-center gap-3 lg:ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-zinc-500 hover:text-primary hover:bg-primary/10"
              onClick={() => setShowEditModal(true)}
            >
              <IconEdit size={18} />
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={isStarting}
              className="bg-primary hover:bg-primary/90"
            >
              <IconPlayerPlay className="mr-2 size-4 fill-current" />
              {isStarting ? "Starting..." : "Start a new session"}
            </Button>
          </div>
        </div>

        {/* Job Description Card: Uses ReactMarkdown for rich text support */}
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                {interview.description ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {interview.description}
                  </ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    No description provided.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Specialized Edit Modal for Interview configurations */}
        {interview && (
          <EditInterviewModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            interview={interview}
            onSuccess={() => {
              // Refresh specific interview data after edit
              const fetchInterview = async () => {
                const response = await fetch(`/api/interviews/${id}`)
                if (response.ok) {
                  const data = await response.json()
                  setInterview(data)
                }
              }
              fetchInterview()
            }}
          />
        )}
      </div>
    </div>
  )
}
