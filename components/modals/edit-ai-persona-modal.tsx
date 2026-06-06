"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VoicePicker } from "@/components/ui/voice-picker"
import {
  IconLoader2,
  IconRobot,
  IconSparkles,
  IconUpload,
  IconRefresh,
} from "@tabler/icons-react"
import { CHARACTERS } from "@/lib/characters"
import { toast } from "sonner"
import { uploadToS3Client } from "@/lib/s3-client"
import { Badge } from "@/components/ui/badge"

interface Agent {
  id: string
  name: string
  instruction: string
  characterId: string | null
  avatar: { url: string; path: string } | null
}

interface EditAiPersonaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: Agent
  onSuccess: () => void
}

export function EditAiPersonaModal({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: EditAiPersonaModalProps) {
  const [name, setName] = useState("")
  const [instruction, setInstruction] = useState("")
  const [characterId, setCharacterId] = useState<string>("")
  const [avatar, setAvatar] = useState<{
    url: string
    path: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false)
  const [goal, setGoal] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (agent) {
      setName(agent.name || "")
      setInstruction(agent.instruction || "")
      setCharacterId(agent.characterId || "")
      setAvatar((agent.avatar as any) || null)
    }
  }, [agent])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsSubmitting(true)
    try {
      // 1. Upload to S3 directly via presigned URL utility
      const path = await uploadToS3Client(file, "avatars")

      // 2. Resolve to a temporary signed URL for local preview
      const res = await fetch(
        `/api/s3/signed-url?path=${encodeURIComponent(path)}`,
      )
      const { url } = await res.json()

      setAvatar({ url, path })
      toast.success("Avatar uploaded")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload image")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRefineInstructions = async () => {
    if (!goal) {
      toast.error("Tell me how you want to change the persona's behavior.")
      return
    }

    setIsGeneratingInfo(true)
    try {
      const response = await fetch("/api/ai-personas/generate-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, name, existingInstructions: instruction }),
      })

      if (!response.ok) throw new Error("Refinement failed")

      const data = await response.json()
      setName(data.name)
      setInstruction(data.instruction)
      toast.success("Instructions refined by AI!")
      setGoal("")
    } catch (error) {
      console.error("Refinement error:", error)
      toast.error("Failed to refine instructions")
    } finally {
      setIsGeneratingInfo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/ai-personas/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          instruction,
          characterId,
          avatar,
        }),
      })

      if (!response.ok) throw new Error("Failed to update persona")

      toast.success("AI Persona updated successfully")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating persona:", error)
      toast.error("Failed to update AI persona")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] bg-zinc-950 border-zinc-900 p-0 overflow-hidden flex flex-col">
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-8 space-y-8">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Edit AI Persona
                </h2>
                <p className="text-sm text-zinc-500">
                  Update name, instructions, and visual identity.
                </p>
              </div>

              <div className="space-y-8">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="text-center space-y-2">
                    <Label className="text-[10px] font-bold tracking-[0.1em] text-primary">
                      Identity
                    </Label>
                  </div>

                  <div
                    className="group relative size-40 rounded-[40px] bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center shadow-2xl ring-4 ring-primary/10 ring-offset-4 ring-offset-[#020202] overflow-hidden cursor-pointer shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatar ? (
                      <Image
                        src={avatar.url}
                        className="w-full h-full object-cover"
                        alt="Preview"
                        width={160}
                        height={160}
                      />
                    ) : (
                      <IconRobot className="size-10 text-primary-foreground" />
                    )}

                    {/* Upload Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconUpload className="text-white size-6" />
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-name"
                      className="text-zinc-400 font-medium text-sm"
                    >
                      Persona Name
                    </Label>
                    <Input
                      id="edit-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sales Expert"
                      className="bg-zinc-900 border-zinc-800 text-white h-11"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400 font-medium text-sm">
                      Voice Model
                    </Label>
                    <VoicePicker
                      voices={CHARACTERS}
                      value={characterId}
                      onValueChange={setCharacterId}
                      className="h-11 border-zinc-800"
                    />
                  </div>

                  <div className="space-y-4 pt-6 border-t border-zinc-900">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="edit-instruction"
                        className="text-zinc-400 font-medium text-sm"
                      >
                        Core Instructions
                      </Label>
                      <Badge
                        variant="outline"
                        className="text-[9px] border-primary/20 text-primary"
                      >
                        AI BUILDER
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="e.g. Make it more professional..."
                        className="bg-zinc-900 border-zinc-800 text-sm h-10"
                        disabled={isGeneratingInfo}
                      />
                      <Button
                        type="button"
                        onClick={handleRefineInstructions}
                        disabled={isGeneratingInfo || !goal}
                        className="h-10 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 whitespace-nowrap px-4"
                      >
                        {isGeneratingInfo ? (
                          <IconLoader2 className="size-4 animate-spin" />
                        ) : (
                          <IconSparkles className="size-4 mr-2" />
                        )}
                        Refine
                      </Button>
                    </div>
                    <Textarea
                      id="edit-instruction"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Define how this persona should behave..."
                      className="min-h-[250px] bg-zinc-900 border-zinc-800 text-zinc-300 resize-none p-4 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="pt-6 flex flex-row items-center justify-end gap-3 pb-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="text-zinc-500"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary hover:bg-primary/90 px-8"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
