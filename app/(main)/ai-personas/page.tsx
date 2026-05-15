/**
 * @file app/(main)/ai-personas/page.tsx
 * @description The AI Personas management page.
 * Allows users to view, create, edit, delete, and start sessions with custom-instructed AI agents.
 * Also includes hooks for publishing agents to the common marketplace.
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { IconDotsVertical, IconPlus, IconRobot } from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCharacter } from "@/lib/characters" // Utility for voice/avatar mapping
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
import { toast } from "sonner"
import { EditAiPersonaModal } from "@/components/modals/edit-ai-persona-modal"

/**
 * CustomAgent Interface
 * Represents a user-defined AI persona with its instructions and metadata.
 */
interface CustomAgent {
  id: string
  name: string
  instruction: string
  characterId: string | null // Maps to a voice/avatar configuration in @/lib/characters
  avatar: { url: string; publicId: string } | null
  createdAt: string
  installedFromId: string | null // Present if this agent was cloned from the marketplace
  installedFrom?: {
    user: {
      name: string
      image: string | null
    }
  }
  interactions: { id: string }[] // Past sessions with this agent
}

/**
 * CustomAgentsPage Component
 * Main dashboard for managing specialized AI agents.
 */
export default function CustomAgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<CustomAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)
  const [agentToEdit, setAgentToEdit] = useState<CustomAgent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * Fetch all agents owned by or installed by the current user.
   */
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-personas")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setAgents(data)
    } catch (error) {
      console.error("Error fetching custom agents:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  /**
   * Initializes a new practice session with a specific AI persona.
   */
  const handleRunAgent = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-personas/${id}/sessions`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to start session")
      const session = await response.json()
      // Redirect to the live session runner
      router.push(`/sessions/${session.id}/run`)
    } catch (error) {
      console.error("Error starting agent session:", error)
      toast.error("Failed to start session")
    }
  }

  /**
   * Deletes a persona. Permanent action.
   */
  const handleDeleteAgent = async (id: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/ai-personas/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete")
      setAgents(agents.filter((a) => a.id !== id))
      setAgentToDelete(null)
      toast.success("AI Persona deleted")
    } catch (error) {
      console.error("Error deleting agent:", error)
      toast.error("Failed to delete AI Persona")
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Publishes the agent to the global marketplace.
   */
  const handleAddToMarketplace = async (id: string) => {
    try {
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ai-persona", id }),
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Personas</h1>
          <p className="text-muted-foreground mt-1">
            Manage your specialized AI personas and their custom instructions.
          </p>
        </div>
        <Link href="/ai-personas/create">
          <Button variant="default" className="font-medium">
            <IconPlus className="mr-2 size-4" />
            Create Persona
          </Button>
        </Link>
      </div>

      {/* Agents Table */}
      <div className="overflow-hidden border-y border-muted/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-muted/50">
              <TableHead className="text-muted-foreground font-medium w-[250px]">
                Persona Name
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Owner
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Voice
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">
                Instructions Preview
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
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading personas...
                </TableCell>
              </TableRow>
            ) : agents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  No personas found. Create your first one above!
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => (
                <TableRow
                  key={agent.id}
                  className="hover:bg-muted/30 border-muted/30"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden relative">
                        {agent.avatar?.url ? (
                          <Image
                            src={agent.avatar.url}
                            fill
                            className="object-cover"
                            alt={agent.name}
                          />
                        ) : (
                          <IconRobot className="size-4 text-primary" />
                        )}
                      </div>
                      <Link
                        href={`/ai-personas/${agent.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {agent.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Shows owner info: either the current user ('Me') or the marketplace author */}
                    {agent.installedFrom ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5 border">
                          <AvatarImage
                            src={agent.installedFrom.user.image || ""}
                          />
                          <AvatarFallback className="text-[8px]">
                            {agent.installedFrom.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {agent.installedFrom.user.name}
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
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      {agent.characterId
                        ? getCharacter(agent.characterId)?.firstName
                        : "Default"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground line-clamp-1 max-w-md">
                      {agent.instruction}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(agent.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-right pr-6">
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
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/ai-personas/${agent.id}`)
                          }
                        >
                          View Details
                        </DropdownMenuItem>
                        {/* Only Allow publishing to marketplace if it's the user's original agent */}
                        {!agent.installedFromId && (
                          <DropdownMenuItem
                            onClick={() => handleAddToMarketplace(agent.id)}
                          >
                            Add to Marketplace
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleRunAgent(agent.id)}
                        >
                          Start New Session
                        </DropdownMenuItem>
                        {/* Quick link to resume the last session with this agent if it exists */}
                        {agent.interactions?.[0] && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/sessions/${agent.interactions[0].id}/run`,
                              )
                            }
                          >
                            Restart Last Session
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setAgentToEdit(agent)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => setAgentToDelete(agent.id)}
                        >
                          Delete
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

      {/* Confirmation for deletion */}
      <DeleteAlertDialog
        open={!!agentToDelete}
        onOpenChange={(open) => !open && setAgentToDelete(null)}
        onConfirm={() => {
          if (agentToDelete) handleDeleteAgent(agentToDelete)
        }}
        isDeleting={isDeleting}
        title="Delete Persona?"
        description="Are you sure you want to delete this AI persona? This action cannot be undone."
      />

      {/* Overlay Modal for editing */}
      {agentToEdit && (
        <EditAiPersonaModal
          open={!!agentToEdit}
          onOpenChange={(open) => !open && setAgentToEdit(null)}
          agent={agentToEdit}
          onSuccess={() => fetchAgents()}
        />
      )}
    </div>
  )
}
