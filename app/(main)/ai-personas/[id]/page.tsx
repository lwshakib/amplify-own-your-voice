/**
 * @file app/(main)/ai-personas/[id]/page.tsx
 * @description The AI Persona detail page.
 * Displays the full profile of a custom AI agent, including its system instructions (rendered in Markdown)
 * and providing controls to edit the persona or start a practice session.
 */

"use client"

import { useEffect, useState, use, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconRobot,
  IconPlayerPlay,
  IconSparkles,
  IconEdit,
  IconRefresh,
} from "@tabler/icons-react"
import { EditAiPersonaModal } from "@/components/modals/edit-ai-persona-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import ReactMarkdown from "react-markdown" // For rich instruction display
import remarkGfm from "remark-gfm" // Supports tables/tasklists in markdown
import { getCharacter } from "@/lib/characters"

/**
 * CustomAgent Interface
 * Defines the technical structure of an AI persona returned from the API.
 */
interface CustomAgent {
  id: string
  name: string
  instruction: string
  characterId: string | null
  avatar: { url: string; publicId: string } | null
  createdAt: string
  interactions: { id: string }[]
}

/**
 * CustomAgentDetailsPage Component
 * @param params - Contains the persona ID from the URL.
 */
export default function CustomAgentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<CustomAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  /**
   * Fetches the persona's full metadata.
   */
  const fetchAgent = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai-personas/${id}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setAgent(data)
    } catch (error) {
      console.error("Error fetching persona:", error)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAgent()
  }, [fetchAgent])

  // Minimalist loading state
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#020202]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium text-sm animate-pulse tracking-wide">
            Initializing persona data...
          </p>
        </div>
      </div>
    )
  }

  // Not found fallback
  if (!agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-[#020202]">
        <div className="size-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
          <IconRobot className="size-8 text-zinc-500" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-zinc-100 font-bold text-xl tracking-tight">
            Persona not found
          </p>
          <p className="text-zinc-500 text-sm">
            The persona you are looking for does not exist or has been deleted.
          </p>
        </div>
        <Link href="/ai-personas">
          <Button variant="outline" className="rounded-full px-8">
            Back to AI Personas
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Header Section: Back button, Name, and Metadata */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/ai-personas">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <IconArrowLeft className="size-4" />
              </Button>
            </Link>
            <div className="relative size-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-muted/50 overflow-hidden">
              {/* Persona Avatar */}
              {agent.avatar?.url ? (
                <Image
                  src={agent.avatar.url}
                  fill
                  className="object-cover"
                  alt={agent.name}
                />
              ) : (
                <IconRobot className="size-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {agent.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  Created{" "}
                  {formatDistanceToNow(new Date(agent.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                <div className="h-3 w-px bg-muted mx-1" />
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium border-primary/20 bg-primary/5 text-primary"
                >
                  AI Persona
                </Badge>
                {/* Voice Information from lib/characters */}
                {agent.characterId && (
                  <>
                    <div className="h-3 w-px bg-muted mx-1" />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium border-muted/50 bg-muted/5 text-muted-foreground capitalize"
                    >
                      Voice:{" "}
                      {getCharacter(agent.characterId)
                        ? `${getCharacter(agent.characterId)?.firstName} ${getCharacter(agent.characterId)?.lastName}`
                        : agent.characterId}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Action Buttons: Edit, Resuming, or Starting a new session */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-zinc-500 hover:text-primary hover:bg-primary/10"
              onClick={() => setShowEditModal(true)}
            >
              <IconEdit size={18} />
            </Button>
            {agent.interactions?.[0] && (
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/sessions/${agent.interactions[0].id}/run`)
                }
                className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
              >
                <IconRefresh className="mr-2 size-4" />
                Restart Last Session
              </Button>
            )}
            <Button
              onClick={async () => {
                setIsStarting(true)
                try {
                  const response = await fetch(
                    `/api/ai-personas/${id}/sessions`,
                    {
                      method: "POST",
                    },
                  )
                  if (!response.ok) throw new Error("Failed to start session")
                  const session = await response.json()
                  // Start the immersive practice runner
                  router.push(`/sessions/${session.id}/run`)
                } catch (error) {
                  console.error("Error starting agent session:", error)
                } finally {
                  setIsStarting(false)
                }
              }}
              disabled={isStarting}
              className="bg-primary hover:bg-primary/90"
            >
              <IconPlayerPlay className="mr-2 size-4 fill-current" />
              {isStarting ? "Initializing..." : "Start New Session"}
            </Button>
          </div>
        </div>

        {/* Persona Instructions Card */}
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <IconSparkles className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground">
                  Core Instructions
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Render the system prompt using Markdown to support lists, bolding, etc. */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {agent.instruction}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Logic for editing the persona details (Name, Instructions, Character) */}
      <EditAiPersonaModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        agent={agent}
        onSuccess={() => fetchAgent()}
      />
    </div>
  )
}
