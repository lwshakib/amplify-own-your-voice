"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VoicePicker } from "@/components/ui/voice-picker"
import { CHARACTERS } from "@/lib/characters"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Interview {
  id: string
  jobTitle: string
  description: string
  type: string
  characterId: string | null
}

interface EditInterviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
  onSuccess: () => void
}

export function EditInterviewModal({
  open,
  onOpenChange,
  interview,
  onSuccess,
}: EditInterviewModalProps) {
  const [jobTitle, setJobTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<string>("TECHNICAL")
  const [characterId, setCharacterId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (interview) {
      setJobTitle(interview.jobTitle || "")
      setDescription(interview.description || "")
      setType(interview.type || "TECHNICAL")
      setCharacterId(interview.characterId || "")
    }
  }, [interview])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/interviews/${interview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          description,
          type,
          characterId,
        }),
      })

      if (!response.ok) throw new Error("Failed to update interview")

      toast.success("Interview updated successfully")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating interview:", error)
      toast.error("Failed to update interview")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Edit Interview
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Update the interview configuration and AI personality.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label
              htmlFor="edit-jobTitle"
              className="text-zinc-400 font-medium"
            >
              Job Title
            </Label>
            <Input
              id="edit-jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="bg-zinc-900 border-zinc-800 text-white h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-400 font-medium">Interviewer</Label>
            <VoicePicker
              voices={CHARACTERS}
              value={characterId}
              onValueChange={setCharacterId}
              className="h-11 border-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-400 font-medium">Interview Type</Label>
            <RadioGroup
              value={type}
              onValueChange={setType}
              className="grid grid-cols-2 gap-4"
            >
              <div className="relative">
                <RadioGroupItem
                  value="TECHNICAL"
                  id="edit-tech"
                  className="sr-only"
                />
                <Label
                  htmlFor="edit-tech"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                    type === "TECHNICAL"
                      ? "bg-primary/5 border-primary/50 text-white"
                      : "bg-zinc-900/50 border-zinc-800 text-zinc-500",
                  )}
                >
                  <Checkbox
                    checked={type === "TECHNICAL"}
                    className="size-4 pointer-events-none"
                  />
                  <span className="text-sm font-semibold">Technical</span>
                </Label>
              </div>
              <div className="relative">
                <RadioGroupItem
                  value="GENERAL"
                  id="edit-gen"
                  className="sr-only"
                />
                <Label
                  htmlFor="edit-gen"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                    type === "GENERAL"
                      ? "bg-primary/5 border-primary/50 text-white"
                      : "bg-zinc-900/50 border-zinc-800 text-zinc-500",
                  )}
                >
                  <Checkbox
                    checked={type === "GENERAL"}
                    className="size-4 pointer-events-none"
                  />
                  <span className="text-sm font-semibold">General</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="edit-description"
              className="text-zinc-400 font-medium"
            >
              Job Description
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the job requirements here..."
              className="min-h-[200px] bg-zinc-900 border-zinc-800 text-zinc-300 resize-none p-4"
              required
            />
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-900">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400"
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
