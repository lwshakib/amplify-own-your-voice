/**
 * @file app/(main)/debates/[id]/page.tsx
 * @description The Debate detail page.
 * Provides a comprehensive view of a specific debate motion, its assigned AI judge,
 * the opposition team members, and the practice history related to it.
 */

"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconScale,
  IconCalendar,
  IconEdit,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { DeleteAlertDialog } from "@/components/modals/delete-alert-dialog"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getCharacter } from "@/lib/characters" // For voice/avatar lookup
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EditDebateModal } from "@/components/modals/edit-debate-modal"

/**
 * Debate Interface
 * Structure for the specialized debate metadata.
 */
interface Debate {
  id: string
  subject: string
  content: string | null
  judgeId: string
  opponentId: string
  opponentIds: string[] // Array of AI characters forming the opposition team
  createdAt: string
  installedFrom?: {
    user: {
      name: string
      image: string | null
    }
  }
  _count?: {
    interactions: number // Count of past sessions for this motion
  }
}

/**
 * DebateDetailsPage Component
 * @param params - Contains the debate ID from the URL.
 */
export default function DebateDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [debate, setDebate] = useState<Debate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * Fetch the full debate configuration on mount.
   */
  useEffect(() => {
    const fetchDebate = async () => {
      try {
        const response = await fetch(`/api/debates/${id}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setDebate(data)
      } catch (error) {
        console.error("Error fetching debate:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDebate()
  }, [id])

  /**
   * Logic to start a live practice session for this debate.
   */
  const handleStartSession = async () => {
    setIsStarting(true)
    try {
      const response = await fetch(`/api/debates/${id}/sessions`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to start session")
      const session = await response.json()
      // Go to the live runner
      router.push(`/sessions/${session.id}/run`)
    } catch (error) {
      console.error("Error starting debate session:", error)
    } finally {
      setIsStarting(false)
    }
  }

  /**
   * Delete the configuration.
   */
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/debates/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete")
      router.push("/debates")
    } catch (error) {
      console.error("Error deleting debate:", error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Elegant loading skeleton replacement
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#020202]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium text-sm animate-pulse">
            Preparing Debate Arena...
          </p>
        </div>
      </div>
    )
  }

  // Not found fallback
  if (!debate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-[#020202]">
        <div className="size-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
          <IconScale className="size-8 text-zinc-500" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-zinc-100 font-bold text-xl tracking-tight">
            Debate not found
          </p>
          <p className="text-zinc-500 text-sm">
            The debate you are looking for does not exist or has been deleted.
          </p>
        </div>
        <Link href="/debates">
          <Button variant="outline" className="rounded-full px-8">
            Back to Debates
          </Button>
        </Link>
      </div>
    )
  }

  const judge = getCharacter(debate.judgeId)

  return (
    <div className="flex flex-1 flex-col bg-[#020202] text-zinc-100 min-h-screen">
      {/* Visual Accents */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-8 py-12 space-y-12">
        {/* Navigation & Actions */}
        <div className="flex items-center justify-between">
          <Link href="/debates">
            <Button
              variant="ghost"
              className="rounded-full gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 group"
            >
              <IconArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              Arena Hall
            </Button>
          </Link>
          <div className="flex items-center gap-3">
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
              className="bg-primary hover:bg-primary/90 shadow-none border-none"
            >
              <IconPlayerPlay className="mr-2 size-4 fill-current" />
              {isStarting ? "Starting..." : "Start a new session"}
            </Button>
          </div>
        </div>

        {/* Hero Section: Subject and basic stats */}
        <div className="space-y-4">
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20 font-semibold text-[11px] px-3 py-1"
            >
              Formal debate motion
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-100 leading-[1.1]">
              {debate.subject}
            </h1>
          </div>

          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2 text-zinc-500">
              <IconCalendar size={14} />
              <span className="text-xs font-medium">
                Proposed{" "}
                {formatDistanceToNow(new Date(debate.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {debate._count && debate._count.interactions > 0 && (
              <div className="flex items-center gap-2 text-zinc-500">
                <IconScale size={14} />
                <span className="text-xs font-medium">
                  {debate._count.interactions} past practice sessions
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Participant Roles: Mapping AI characters to their debating functions */}
          <Card className="bg-zinc-950 border-zinc-900 shadow-none">
            <CardHeader>
              <CardTitle className="text-xs font-bold tracking-tight text-zinc-500">
                Debate Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* The Moderating Judge */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-900">
                <Avatar className="size-10 rounded-lg border border-zinc-800">
                  <AvatarImage src={judge?.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    {judge?.firstName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-[10px] font-bold text-primary mb-0.5">
                    The Judge
                  </div>
                  <div className="text-sm font-semibold text-zinc-100">
                    {judge?.firstName} {judge?.lastName}
                  </div>
                </div>
              </div>

              {/* The Opposition Team (Multi-Speaker) */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-zinc-500 pl-1">
                  Opposition Team
                </div>
                <div className="grid gap-3">
                  {(debate.opponentIds || [debate.opponentId]).map(
                    (oppId, idx) => {
                      const char = getCharacter(oppId)
                      const roles = ["Leader", "Deputy", "Whip"] // Traditional parliamentary debate roles
                      return (
                        <div
                          key={oppId}
                          className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/30 border border-zinc-900"
                        >
                          <Avatar className="size-8 rounded-lg border border-zinc-800">
                            <AvatarImage src={char?.avatar} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[8px]">
                              {char?.firstName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-[10px] font-bold text-zinc-400">
                              {roles[idx] || "Member"}
                            </div>
                            <div className="text-xs font-semibold text-zinc-200">
                              {char?.firstName} {char?.lastName}
                            </div>
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Motion Context: Extended rules or facts provided for this specific motion */}
          <div className="space-y-8">
            <Card className="bg-zinc-950 border-zinc-900 shadow-none">
              <CardHeader>
                <CardTitle className="text-xs font-bold tracking-tight text-zinc-500">
                  Motion context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-6 rounded-xl bg-zinc-900/30 border border-zinc-900 min-h-[160px]">
                  {debate.content ? (
                    <div className="prose prose-invert prose-sm text-zinc-400 max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {debate.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm italic">
                      No additional context provided for this motion.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Attribution if cloned from marketplace */}
            {debate.installedFrom && (
              <Card className="bg-zinc-950 border-zinc-900 shadow-none">
                <CardHeader>
                  <CardTitle className="text-xs font-bold tracking-tight text-zinc-500">
                    Motion author
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-900">
                    <Avatar className="size-10 border border-zinc-800">
                      <AvatarImage
                        src={debate.installedFrom.user.image || ""}
                      />
                      <AvatarFallback className="text-xs bg-zinc-900">
                        {debate.installedFrom.user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 mb-0.5">
                        Created by
                      </div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {debate.installedFrom.user.name}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation & Edit logic */}
      <DeleteAlertDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title="Dissolve Debate?"
        description={`This will permanently remove "${debate.subject}" from your records.`}
      />

      <EditDebateModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        debate={debate}
        onSuccess={() => {
          // Refresh local state after edit
          const fetchDebate = async () => {
            const response = await fetch(`/api/debates/${id}`)
            if (response.ok) {
              const data = await response.json()
              setDebate(data)
            }
          }
          fetchDebate()
        }}
      />
    </div>
  )
}
