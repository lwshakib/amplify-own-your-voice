/**
 * @file app/(main)/interviews/page.tsx
 * @description The Interviews dashboard.
 * Manages interview configurations (Job Title, Description, and AI Interviewer).
 * Allows users to track their custom interview setups and those installed from the marketplace.
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { IconDotsVertical, IconPlus } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { DeleteAlertDialog } from "@/components/modals/delete-alert-dialog"
import { getCharacter } from "@/lib/characters" // Custom hook/utility to fetch character metadata
import { toast } from "sonner"
import { EditInterviewModal } from "@/components/modals/edit-interview-modal"

/**
 * Interview Interface
 * Represents a saved interview configuration.
 */
interface Interview {
  id: string
  jobTitle: string
  description: string
  type: string
  createdAt: string
  user: {
    name: string
    image: string | null
  }
  characterId: string | null // The AI personality conducting the interview
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
 * InterviewsPage Component
 * Provides a table view of all interview definitions created or installed by the user.
 */
export default function InterviewsPage() {
  const router = useRouter()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [interviewToDelete, setInterviewToDelete] = useState<string | null>(
    null,
  )
  const [interviewToEdit, setInterviewToEdit] = useState<Interview | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * Fetches user's interview configurations on mount.
   */
  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        const response = await fetch("/api/interviews")
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setInterviews(data)
      } catch (error) {
        console.error("Error fetching interviews:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInterviews()
  }, [])

  /**
   * Initializes a live practice session for a specific interview.
   */
  const handleStartSession = async (interviewId: string) => {
    try {
      const response = await fetch(`/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      })
      if (!response.ok) throw new Error("Failed to start session")
      const session = await response.json()
      // Push to the dynamic session runner
      router.push(`/sessions/${session.id}/run`)
    } catch (error) {
      console.error("Error starting session:", error)
      toast.error("Failed to start session")
    }
  }

  /**
   * Logic to delete an interview configuration.
   */
  const handleDeleteInterview = async (id: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/interviews/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete")
      setInterviews(interviews.filter((i) => i.id !== id))
      setInterviewToDelete(null)
      toast.success("Interview deleted")
    } catch (error) {
      console.error("Error deleting interview:", error)
      toast.error("Failed to delete interview")
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Marketplace Integration: Share a custom interview with the community.
   */
  const handleAddToMarketplace = async (id: string) => {
    try {
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "interview", id }),
      })
      if (!response.ok) throw new Error("Failed to add to marketplace")
      toast.success("Added to Marketplace!")
    } catch (error) {
      console.error("Error adding to marketplace:", error)
      toast.error("Failed to add to marketplace")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Interviews</h1>
        {/* Link to the specialized creation flow */}
        <Link href="/interviews/create">
          <Button variant="default" className="font-medium">
            <IconPlus className="mr-2 size-4" />
            Create interview
          </Button>
        </Link>
      </div>

      {/* Main Table View */}
      <div className="overflow-hidden border-y border-muted/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-muted/50">
              <TableHead className="text-muted-foreground font-medium">
                Interviewer
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Job Title
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Owner
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Created
              </TableHead>
              <TableHead className="text-right text-muted-foreground font-medium pr-6">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading interviews...
                </TableCell>
              </TableRow>
            ) : interviews.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-10 text-muted-foreground"
                >
                  No interviews found. Create your first one above!
                </TableCell>
              </TableRow>
            ) : (
              interviews.map((interview) => (
                <TableRow
                  key={interview.id}
                  className="hover:bg-muted/30 border-muted/30"
                >
                  <TableCell className="py-4">
                    {/* The AI Interviewer details */}
                    <Link
                      href={`/interviews/${interview.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="h-8 w-8 border border-muted/50">
                        <AvatarImage
                          src={
                            getCharacter(interview.characterId || "")?.avatar
                          }
                          alt={
                            getCharacter(interview.characterId || "")?.firstName
                          }
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {
                            getCharacter(interview.characterId || "")
                              ?.firstName?.[0]
                          }
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium hover:underline">
                        {getCharacter(interview.characterId || "")
                          ? `${getCharacter(interview.characterId || "")?.firstName} ${getCharacter(interview.characterId || "")?.lastName}`
                          : "Unknown Interviewer"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/interviews/${interview.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {interview.jobTitle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {/* Cloned vs Original status */}
                    {interview.installedFrom ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5 border">
                          <AvatarImage
                            src={interview.installedFrom.user.image || ""}
                          />
                          <AvatarFallback className="text-[8px]">
                            {interview.installedFrom.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {interview.installedFrom.user.name}
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
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(interview.createdAt), {
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
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <IconDotsVertical className="size-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-52 bg-zinc-950 border-zinc-800 text-zinc-300"
                      >
                        <Link href={`/interviews/${interview.id}`}>
                          <DropdownMenuItem className="cursor-pointer hover:text-white">
                            View Details
                          </DropdownMenuItem>
                        </Link>
                        {!interview.installedFromId && (
                          <DropdownMenuItem
                            className="cursor-pointer hover:text-white"
                            onClick={() => handleAddToMarketplace(interview.id)}
                          >
                            Add to Marketplace
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer hover:text-white"
                          onClick={() => handleStartSession(interview.id)}
                        >
                          New Session
                        </DropdownMenuItem>
                        {interview.interactions?.[0] && (
                          <DropdownMenuItem
                            className="cursor-pointer hover:text-white"
                            onClick={() =>
                              router.push(
                                `/sessions/${interview.interactions[0].id}/run`,
                              )
                            }
                          >
                            Restart Last Session
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer hover:text-white"
                          onClick={() => setInterviewToEdit(interview)}
                        >
                          Edit Interview
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer focus:text-destructive focus:bg-red-500/10"
                          onClick={() => setInterviewToDelete(interview.id)}
                        >
                          Delete Interview
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

      {!isLoading && interviews.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {interviews.length}
            </span>{" "}
            results
          </p>
        </div>
      )}

      {/* Confirmation & Overlay Modals */}
      <DeleteAlertDialog
        open={!!interviewToDelete}
        onOpenChange={(open) => !open && setInterviewToDelete(null)}
        onConfirm={() => {
          if (interviewToDelete) handleDeleteInterview(interviewToDelete)
        }}
        isDeleting={isDeleting}
        title="Delete Interview?"
        description="Are you sure you want to delete this interview definition? This will NOT delete associated sessions."
      />

      {interviewToEdit && (
        <EditInterviewModal
          open={!!interviewToEdit}
          onOpenChange={(open) => !open && setInterviewToEdit(null)}
          interview={interviewToEdit}
          onSuccess={() => {
            // Re-fetch list on success
            const fetchInterviews = async () => {
              const response = await fetch("/api/interviews")
              if (response.ok) {
                const data = await response.json()
                setInterviews(data)
              }
            }
            fetchInterviews()
          }}
        />
      )}
    </div>
  )
}
