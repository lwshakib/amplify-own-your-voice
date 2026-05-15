/**
 * @file app/(main)/sessions/page.tsx
 * @description The list view for all practice sessions (Interviews, Debates, AI Persona chats).
 * Provides a table with session metadata, status indicators, and actions to view, continue, or delete sessions.
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  IconDotsVertical,
  IconPlus,
  IconExternalLink,
} from "@tabler/icons-react"
import { QuickCreateDialog } from "@/components/modals/quick-create-dialog" // Modal for starting new sessions quickly

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
import { formatDistanceToNow } from "date-fns" // For human-readable relative dates (e.g., "2 days ago")
import { authClient } from "@/lib/auth-client"
import { DeleteAlertDialog } from "@/components/modals/delete-alert-dialog" // Confirm delete modal
import { cn } from "@/lib/utils"
import {
  INTERACTION_TYPE_LABELS,
  INTERACTION_STATUS_LABELS,
} from "@/lib/constants" // Predefined human-readable labels

/**
 * Interface for a Session object returned from the API.
 */
interface Session {
  id: string
  status: string
  createdAt: string
  type: "interview" | "debate" | "ai-persona"
  interview?: {
    jobTitle: string
  }
  debate?: {
    subject: string
  }
  aiPersona?: {
    name: string
  }
}

/**
 * SessionsPage Component
 * @returns A table-based interface for managing all user-initiated practice sessions.
 */
export default function SessionsPage() {
  const { data: authSession } = authClient.useSession()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // State for the delete confirmation flow
  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string
    type: "interview" | "debate" | "ai-persona"
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // State for the "New Session" quick create modal
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)

  /**
   * Effect: Fetch sessions when the authentication session is established.
   */
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/sessions")
        if (!response.ok) throw new Error("Failed to fetch sessions")
        const data = await response.json()
        setSessions(data)
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (authSession) {
      fetchSessions()
    }
  }, [authSession])

  /**
   * Handles deleting a single session from the backend and local state.
   */
  const handleDeleteSession = async (sessionId: string, type: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}?type=${type}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete")

      // Optimistically remove the session from state
      setSessions(sessions.filter((s) => s.id !== sessionId))
      setSessionToDelete(null)
    } catch (error) {
      console.error("Error deleting session:", error)
      alert("Failed to delete session")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Practice Sessions
          </h1>
          <p className="text-muted-foreground">
            Track your progress and review previous results from interviews and
            debates.
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setIsQuickCreateOpen(true)}
            variant="default"
            className="font-medium"
          >
            <IconPlus className="mr-2 size-4" />
            New Session
          </Button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-hidden border-y border-muted/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-muted/50">
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                Type
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[300px]">
                Subject / Job Title
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Started
              </TableHead>
              <TableHead className="text-right text-muted-foreground font-medium pr-6">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Loading Skeleton: Rendered while the data is still being fetched */}
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell>
                    <div className="h-5 w-16 bg-muted rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-40 bg-muted rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-20 bg-muted rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-24 bg-muted rounded" />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="h-8 w-8 bg-muted rounded ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  No sessions found. Start a new session to see it here.
                </TableCell>
              </TableRow>
            ) : (
              // Main Data: Loop through each session
              sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="hover:bg-muted/30 border-muted/30 group"
                >
                  {/* Type Badge (Interview vs Debate etc) */}
                  <TableCell className="py-4">
                    <Badge variant="outline">
                      {INTERACTION_TYPE_LABELS[
                        session.type.toUpperCase().replace("-", "_")
                      ] || session.type}
                    </Badge>
                  </TableCell>

                  {/* Main Link/Title */}
                  <TableCell className="py-4">
                    <Link
                      href={`/sessions/${session.id}`}
                      className="flex flex-col"
                    >
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {session.type === "interview"
                          ? session.interview?.jobTitle
                          : session.type === "debate"
                            ? session.debate?.subject
                            : session.aiPersona?.name}
                      </span>
                    </Link>
                  </TableCell>

                  {/* Status Badge: Colored based on COMPLETED vs IN_PROGRESS */}
                  <TableCell>
                    {(() => {
                      const status = session.status.toUpperCase()
                      const isCompleted = status === "COMPLETED"
                      const isInProgress = status === "IN_PROGRESS"

                      return (
                        <Badge
                          variant={isCompleted ? "default" : "secondary"}
                          className={cn(
                            "px-2.5 py-0.5 font-bold tracking-tight border shadow-sm transition-colors",
                            isCompleted &&
                              "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
                            isInProgress &&
                              "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
                          )}
                        >
                          {INTERACTION_STATUS_LABELS[
                            status.replace(/\s/g, "_")
                          ] || session.status}
                        </Badge>
                      )
                    })()}
                  </TableCell>

                  {/* Relative date of creation */}
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(session.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>

                  {/* Actions Area */}
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      {/* Quick View Link if completed */}
                      {session.status.toUpperCase() === "COMPLETED" && (
                        <Link href={`/sessions/${session.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 hidden md:flex"
                          >
                            View Report
                            <IconExternalLink className="size-3.5" />
                          </Button>
                        </Link>
                      )}

                      {/* Dropdown Menu for secondary or destructive actions */}
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
                        <DropdownMenuContent align="end" className="w-48">
                          <Link href={`/sessions/${session.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              View Report
                            </DropdownMenuItem>
                          </Link>
                          {/* Option to continue session if interrupted */}
                          {session.status.toUpperCase() !== "COMPLETED" && (
                            <Link href={`/sessions/${session.id}/run`}>
                              <DropdownMenuItem className="cursor-pointer">
                                Continue{" "}
                                {session.type === "interview"
                                  ? "Interview"
                                  : session.type === "debate"
                                    ? "Debate"
                                    : "Session"}
                              </DropdownMenuItem>
                            </Link>
                          )}
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() =>
                              setSessionToDelete({
                                id: session.id,
                                type: session.type,
                              })
                            }
                          >
                            Delete Session
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer stats: Showing total count */}
      {!isLoading && sessions.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {sessions.length}
            </span>{" "}
            session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Reusable Dialog for deletion confirmation */}
      <DeleteAlertDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            handleDeleteSession(sessionToDelete.id, sessionToDelete.type)
          }
        }}
        isDeleting={isDeleting}
        title="Delete Session?"
        description="Are you sure you want to delete this session? This will permanently remove all chat history and analytics associated with it."
      />

      {/* Global Quick Create modal for starting work immediately */}
      <QuickCreateDialog
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
      />
    </div>
  )
}
