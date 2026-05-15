/**
 * @file app/(main)/debates/page.tsx
 * @description The Debates dashboard.
 * Manages debate motions (subjects), allowing users to configure formal debates with AI judges and opponents.
 * Includes features for AI-assisted motion generation and marketplace sharing.
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  IconDotsVertical,
  IconPlus,
  IconLoader2,
  IconInfoCircle,
  IconReport,
  IconSparkles,
  IconSquareRoundedX,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { authClient } from "@/lib/auth-client"
import { formatDistanceToNow } from "date-fns"
import { DeleteAlertDialog } from "@/components/modals/delete-alert-dialog"
import { toast } from "sonner"
import { PREDEFINED_DEBATE_MOTIONS } from "@/lib/constants"
import { motion } from "framer-motion"
import { VoicePicker } from "@/components/ui/voice-picker" // Component to select AI Character voice/personality
import { CHARACTERS } from "@/lib/characters" // Static list of available AI personas
import { EditDebateModal } from "@/components/modals/edit-debate-modal"

/**
 * Debate Interface
 * Defines a debate configuration: the topic, the judge, and the opposing team.
 */
interface Debate {
  id: string
  subject: string
  content: string | null
  judgeId: string | null
  opponentId: string | null
  opponentIds: string[] // Supporting multiple AI speakers in a team
  createdAt: string
  interactions: { id: string }[]
  installedFromId: string | null
  installedFrom?: {
    user: {
      name: string
      image: string | null
    }
  }
}

/**
 * DebatesPage Component
 * Provides a table view of created debates and a modal for configuring new ones.
 */
export default function DebatesPage() {
  const router = useRouter()
  const { data: authSession } = authClient.useSession()

  // State for data listing
  const [debates, setDebates] = useState<Debate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // State for Create/Edit Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newDebate, setNewDebate] = useState({ subject: "", content: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [debateToDelete, setDebateToDelete] = useState<string | null>(null)
  const [debateToEdit, setDebateToEdit] = useState<Debate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // AI Generation State (for automatically refining debate motions)
  const [isGeneratingMotion, setIsGeneratingMotion] = useState(false)
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)
  const [randomSuggestions, setRandomSuggestions] = useState<string[]>([])

  // Default configuration for the AI 'Environment'
  const [judgeId, setJudgeId] = useState<string>("saturn")
  const [oppositionTeam, setOppositionTeam] = useState<string[]>([
    "orpheus",
    "pluto",
    "marcus",
  ])

  /**
   * Selects 3 random predefined motions to show user as inspiration.
   */
  const randomizeSuggestions = () => {
    const shuffled = [...PREDEFINED_DEBATE_MOTIONS].sort(
      () => 0.5 - Math.random(),
    )
    setRandomSuggestions(shuffled.slice(0, 3))
  }

  useEffect(() => {
    if (isCreateModalOpen) randomizeSuggestions()
  }, [isCreateModalOpen])

  /**
   * Fetch all debate configurations for the user.
   */
  const fetchDebates = async () => {
    try {
      const response = await fetch("/api/debates")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setDebates(data)
    } catch (error) {
      console.error("Error fetching debates:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (authSession) fetchDebates()
  }, [authSession])

  /**
   * Persists a new debate configuration.
   */
  const handleCreateDebate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newDebate.subject,
          content: newDebate.content,
          judgeId: judgeId,
          opponentIds: oppositionTeam,
          opponentId: oppositionTeam[0], // Primary opponent for simpler legacy logic
        }),
      })
      if (!response.ok) throw new Error("Failed to create")
      setIsCreateModalOpen(false)
      setNewDebate({ subject: "", content: "" })
      await fetchDebates()
      toast.success("Debate motion created!")
    } catch (error) {
      console.error("Error creating debate:", error)
      toast.error("Failed to create debate")
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Initializes a live session based on a debate configuration.
   */
  const handleStartSession = async (
    debateId: string,
    userSide: string = "FOR",
  ) => {
    try {
      const response = await fetch(`/api/debates/${debateId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userSide }),
      })
      if (!response.ok) throw new Error("Failed to start session")
      const session = await response.json()
      // Redirect to the dynamic session runner
      router.push(`/sessions/${session.id}/run`)
    } catch (error) {
      console.error("Error starting session:", error)
      toast.error("Failed to start session")
    }
  }

  /**
   * Logic for deleting a configuration.
   */
  const handleDeleteDebate = async (id: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/debates/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete")
      setDebates(debates.filter((d) => d.id !== id))
      setDebateToDelete(null)
      toast.success("Debate deleted")
    } catch (error) {
      console.error("Error deleting debate:", error)
      toast.error("Failed to delete debate")
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Marketplace Integration.
   */
  const handleAddToMarketplace = async (id: string) => {
    try {
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "debate", id }),
      })
      if (!response.ok) throw new Error("Failed to add to marketplace")
      toast.success("Added to Marketplace!")
    } catch (error) {
      console.error("Error adding to marketplace:", error)
      toast.error("Failed to add to marketplace")
    }
  }

  /**
   * AI feature to 'refine' a simple topic into a formal debate motion.
   */
  const handleGenerateMotion = async () => {
    if (!newDebate.subject) {
      toast.error("Please enter a topic first")
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setIsGeneratingMotion(true)

    try {
      const response = await fetch("/api/generate/debate-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newDebate.subject }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Failed to generate motion")
      const data = await response.json()
      setNewDebate({ ...newDebate, subject: data.motion })
      toast.success("Motion generated!")
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info("Generation stopped")
      } else {
        console.error("Error generating motion:", error)
        toast.error("Failed to generate motion")
      }
    } finally {
      setIsGeneratingMotion(false)
      setAbortController(null)
    }
  }

  const stopGeneration = () => {
    if (abortController) abortController.abort()
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      {/* Page Header */}
      <div className="flex items-center justify-between text-white">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Debates</h1>
          <p className="text-muted-foreground">
            Practice formal intellectual activities with AI judges and
            opponents.
          </p>
        </div>

        {/* Create Debate Dialog */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button variant="default" className="font-medium">
              <IconPlus className="mr-2 size-4" />
              Create Debate
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden">
            <form
              onSubmit={handleCreateDebate}
              className="flex flex-col h-full"
            >
              <DialogHeader className="p-6 pb-2">
                <DialogTitle>Start New Debate</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Define the motion. AI Judge and Opponents will be selected
                  automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
                {/* Topic Input & AI Motion Generation */}
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="subject" className="text-zinc-300">
                      Debate Motion (Subject)
                    </Label>
                    <div className="relative group/motion">
                      <Input
                        id="subject"
                        placeholder="This house believes that..."
                        className="bg-zinc-900 border-zinc-800 focus:ring-primary/50 pr-12 h-12 rounded-lg transition-all duration-300 group-hover/motion:border-zinc-700"
                        value={newDebate.subject}
                        onChange={(e) =>
                          setNewDebate({
                            ...newDebate,
                            subject: e.target.value,
                          })
                        }
                        required
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        {isGeneratingMotion ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={stopGeneration}
                            className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-400/10 rounded-lg animate-pulse"
                            title="Stop Generation"
                          >
                            <IconSquareRoundedX size={18} />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleGenerateMotion}
                            disabled={!newDebate.subject}
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-300 disabled:opacity-30"
                            title="Generate with AI"
                          >
                            <IconSparkles size={18} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Quick Suggestions list */}
                    <div className="flex flex-col gap-2 mt-3 text-white">
                      {randomSuggestions.map((suggestion, idx) => (
                        <motion.button
                          key={suggestion}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          type="button"
                          onClick={() =>
                            setNewDebate({ ...newDebate, subject: suggestion })
                          }
                          className="w-full text-left text-[11px] bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 px-4 py-2.5 rounded-lg transition-all duration-300 font-medium line-clamp-1"
                        >
                          {suggestion}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Context Field */}
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="content" className="text-zinc-300">
                      Relative Content / Extra Info
                    </Label>
                    <IconInfoCircle className="size-3.5 text-zinc-500" />
                  </div>
                  <Textarea
                    id="content"
                    placeholder="Provide additional context, facts, or rules for the AI to consider..."
                    className="min-h-[120px] bg-zinc-900 border-zinc-800 focus:ring-primary/50 resize-none rounded-lg"
                    value={newDebate.content}
                    onChange={(e) =>
                      setNewDebate({ ...newDebate, content: e.target.value })
                    }
                  />
                </div>

                {/* AI Judge Selection */}
                <div className="space-y-4">
                  <Label className="text-zinc-300">Select AI Judge</Label>
                  <VoicePicker
                    voices={CHARACTERS.filter(
                      (c) => !oppositionTeam.includes(c.id),
                    )}
                    value={judgeId}
                    onValueChange={setJudgeId}
                    placeholder="Choose a judge..."
                    className="h-12 bg-zinc-900 border-zinc-800 focus:ring-primary/50 text-white rounded-lg"
                  />
                </div>

                {/* Opposition Team Configuration (3 speakers) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-4">
                  {[0, 1, 2].map((pos) => (
                    <div key={pos} className="space-y-4">
                      <Label className="text-zinc-300 flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] h-4">
                          Speaker {pos + 1}
                        </Badge>
                        {pos === 0
                          ? "1st speaker"
                          : pos === 1
                            ? "2nd speaker"
                            : "3rd speaker"}
                      </Label>
                      <VoicePicker
                        voices={CHARACTERS.filter(
                          (c) =>
                            c.id !== judgeId &&
                            !oppositionTeam
                              .filter((_, i) => i !== pos)
                              .includes(c.id),
                        )}
                        value={oppositionTeam[pos]}
                        onValueChange={(val) => {
                          const next = [...oppositionTeam]
                          next[pos] = val
                          setOppositionTeam(next)
                        }}
                        placeholder="Choose speaker..."
                        className="h-12 bg-zinc-900 border-zinc-800 focus:ring-primary/50 text-white rounded-lg"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4 pb-12">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !newDebate.subject}
                    className="px-8"
                  >
                    {isSubmitting ? (
                      <>
                        <IconLoader2 className="mr-2 size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Debate"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Debates Table */}
      <div className="overflow-hidden border-y border-muted/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-muted/30">
              <TableHead className="text-zinc-400 font-medium w-[300px]">
                Motion / Subject
              </TableHead>
              <TableHead className="text-zinc-400 font-medium">Owner</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right pr-6">
                Created
              </TableHead>
              <TableHead className="text-right text-zinc-400 font-medium pr-6 w-[100px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loading state
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse border-muted/30">
                  <TableCell>
                    <div className="h-5 w-72 bg-muted/30 rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-20 bg-muted/30 rounded" />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="h-5 w-24 bg-muted/30 rounded ml-auto" />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="h-8 w-8 bg-muted/30 rounded ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : debates.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="h-48 text-center text-zinc-500"
                >
                  <div className="flex flex-col items-center gap-3">
                    <IconReport className="size-10 text-zinc-800" />
                    <p>
                      No debates found. Define your first motion to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              debates.map((debate) => (
                <TableRow
                  key={debate.id}
                  className="hover:bg-muted/30 border-muted/30 group"
                >
                  <TableCell className="py-5">
                    <Link
                      href={`/debates/${debate.id}`}
                      className="flex flex-col gap-1"
                    >
                      <span className="font-semibold text-zinc-100 group-hover:text-primary transition-colors text-sm">
                        {debate.subject}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {/* Owner logic matching the AI Personas dashboard */}
                    {debate.installedFrom ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5 border border-zinc-800">
                          <AvatarImage
                            src={debate.installedFrom.user.image || ""}
                          />
                          <AvatarFallback className="text-[8px] bg-zinc-900">
                            {debate.installedFrom.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-zinc-300">
                          {debate.installedFrom.user.name}
                        </span>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-primary/5 text-primary border-primary/20 text-[10px]"
                      >
                        Me
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-right pr-6">
                    {formatDistanceToNow(new Date(debate.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                          <IconDotsVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-zinc-950 border-zinc-800 text-zinc-300"
                      >
                        <Link href={`/debates/${debate.id}`}>
                          <DropdownMenuItem className="cursor-pointer hover:text-white">
                            View Details
                          </DropdownMenuItem>
                        </Link>
                        {!debate.installedFromId && (
                          <DropdownMenuItem
                            onClick={() => handleAddToMarketplace(debate.id)}
                          >
                            Add to Marketplace
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleStartSession(debate.id)}
                        >
                          New Session
                        </DropdownMenuItem>
                        {debate.interactions?.[0] && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/sessions/${debate.interactions[0].id}/run`,
                              )
                            }
                          >
                            Restart Last Session
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDebateToEdit(debate)}
                        >
                          Edit Debate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDebateToDelete(debate.id)}
                        >
                          Delete Debate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation & Edit Overlays */}
      <DeleteAlertDialog
        open={!!debateToDelete}
        onOpenChange={(open) => !open && setDebateToDelete(null)}
        onConfirm={() => {
          if (debateToDelete) handleDeleteDebate(debateToDelete)
        }}
        isDeleting={isDeleting}
        title="Delete Debate?"
        description="Are you sure you want to delete this debate configuration? This will NOT delete past completed sessions."
      />

      {debateToEdit && (
        <EditDebateModal
          open={!!debateToEdit}
          onOpenChange={(open) => !open && setDebateToEdit(null)}
          debate={debateToEdit}
          onSuccess={() => fetchDebates()}
        />
      )}
    </div>
  )
}
