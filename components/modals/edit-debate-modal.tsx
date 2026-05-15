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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import { PREDEFINED_DEBATE_MOTIONS } from "@/lib/constants"
import { motion } from "framer-motion"

interface Debate {
  id: string
  subject: string
  content: string | null
  judgeId: string | null
  opponentId: string | null
  opponentIds: string[]
}

interface EditDebateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  debate: Debate
  onSuccess: () => void
}

export function EditDebateModal({
  open,
  onOpenChange,
  debate,
  onSuccess,
}: EditDebateModalProps) {
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [judgeId, setJudgeId] = useState("")
  const [oppositionTeam, setOppositionTeam] = useState<string[]>(["", "", ""])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [randomSuggestions, setRandomSuggestions] = useState<string[]>([])

  const randomizeSuggestions = () => {
    const shuffled = [...PREDEFINED_DEBATE_MOTIONS].sort(
      () => 0.5 - Math.random(),
    )
    setRandomSuggestions(shuffled.slice(0, 3))
  }

  useEffect(() => {
    if (debate) {
      setSubject(debate.subject || "")
      setContent(debate.content || "")
      setJudgeId(debate.judgeId || "")
      setOppositionTeam(debate.opponentIds || [debate.opponentId, "", ""])
    }
    randomizeSuggestions()
  }, [debate, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/debates/${debate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          content,
          judgeId,
          opponentIds: oppositionTeam,
        }),
      })

      if (!response.ok) throw new Error("Failed to update debate")

      toast.success("Debate updated successfully")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating debate:", error)
      toast.error("Failed to update debate")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col bg-zinc-950 border-zinc-900 text-white p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Edit Debate Motion
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Update the motion, content, and the panel of AI debaters.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label
                  htmlFor="edit-subject"
                  className="text-zinc-400 font-medium"
                >
                  Motion / Subject
                </Label>
                <Input
                  id="edit-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. This House believes AI is the future of education"
                  className="bg-zinc-900 border-zinc-800 text-white h-11"
                  required
                />

                {/* Suggestions */}
                <div className="flex flex-col gap-2 mt-2">
                  {randomSuggestions.map((suggestion, idx) => (
                    <motion.button
                      key={`${suggestion}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      type="button"
                      onClick={() => setSubject(suggestion)}
                      className="w-full text-left text-[11px] bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 px-4 py-2 rounded-lg transition-all duration-300 font-medium line-clamp-1"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-zinc-400 font-medium">AI Judge</Label>
                <VoicePicker
                  voices={CHARACTERS.filter(
                    (c) => !oppositionTeam.includes(c.id),
                  )}
                  value={judgeId}
                  onValueChange={setJudgeId}
                  placeholder="Choose a judge..."
                  className="h-11 bg-zinc-900 border-zinc-800 text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400 font-medium flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[8px] h-4">
                      SPEAKER 1
                    </Badge>
                    1st Speaker
                  </Label>
                  <VoicePicker
                    voices={CHARACTERS.filter(
                      (c) =>
                        c.id !== judgeId &&
                        c.id !== oppositionTeam[1] &&
                        c.id !== oppositionTeam[2],
                    )}
                    value={oppositionTeam[0]}
                    onValueChange={(val) =>
                      setOppositionTeam([
                        val,
                        oppositionTeam[1],
                        oppositionTeam[2],
                      ])
                    }
                    placeholder="Primary Speaker..."
                    className="h-11 bg-zinc-900 border-zinc-800 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400 font-medium flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[8px] h-4">
                      SPEAKER 2
                    </Badge>
                    2nd Speaker
                  </Label>
                  <VoicePicker
                    voices={CHARACTERS.filter(
                      (c) =>
                        c.id !== judgeId &&
                        c.id !== oppositionTeam[0] &&
                        c.id !== oppositionTeam[2],
                    )}
                    value={oppositionTeam[1]}
                    onValueChange={(val) =>
                      setOppositionTeam([
                        oppositionTeam[0],
                        val,
                        oppositionTeam[2],
                      ])
                    }
                    placeholder="Secondary Speaker..."
                    className="h-11 bg-zinc-900 border-zinc-800 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400 font-medium flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[8px] h-4">
                      SPEAKER 3
                    </Badge>
                    3rd Speaker
                  </Label>
                  <VoicePicker
                    voices={CHARACTERS.filter(
                      (c) =>
                        c.id !== judgeId &&
                        c.id !== oppositionTeam[0] &&
                        c.id !== oppositionTeam[1],
                    )}
                    value={oppositionTeam[2]}
                    onValueChange={(val) =>
                      setOppositionTeam([
                        oppositionTeam[0],
                        oppositionTeam[1],
                        val,
                      ])
                    }
                    placeholder="Supporting Speaker..."
                    className="h-11 bg-zinc-900 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="edit-content"
                  className="text-zinc-400 font-medium"
                >
                  Motion Context (Optional)
                </Label>
                <Textarea
                  id="edit-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Provide additional context, facts, or rules for the AI to consider..."
                  className="min-h-[120px] bg-zinc-900 border-zinc-800 text-zinc-300 resize-none p-4 rounded-lg"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t border-zinc-900">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 px-8 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
