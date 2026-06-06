/**
 * @file app/(main)/interviews/create/page.tsx
 * @description The Interview Creation workspace.
 * Provides a specialized form for defining a new interview, including AI-assisted
 * job description generation and interviewer personality selection.
 */

"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { IconArrowLeft, IconSparkles } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { toast } from "sonner"
import { cn } from "@/lib/utils"
// Component for picking AI Character with voice samples
import { VoicePicker } from "@/components/ui/voice-picker"
import { CHARACTERS } from "@/lib/characters"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

/**
 * CreateInterviewPage Component
 * Orchestrates the creation of a new 'Interview' definition.
 */
export default function CreateInterviewPage() {
  const router = useRouter()
  // Submission and Generation states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Form Field States
  const [description, setDescription] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [type, setType] = useState<string>("GENERAL")
  const [characterId, setCharacterId] = useState<string>("orpheus") // Default interviewer

  const eventSourceRef = useRef<EventSource | null>(null)

  // Clean up connection on component unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  /**
   * AI Job Description Generation
   * Streams a generated job description from the backend using Server-Sent Events (SSE).
   */
  const handleGenerateDescription = async () => {
    if (!jobTitle.trim()) {
      toast.error("Please enter a job title first.")
      return
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setIsGenerating(true)
    setDescription("") // Reset text buffer

    const params = new URLSearchParams({
      jobTitle,
      type,
    })

    const eventSource = new EventSource(
      `/api/generate-job-description?${params.toString()}`,
    )
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log("SSE Connection opened")
    }

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close()
        eventSourceRef.current = null
        setIsGenerating(false)
        return
      }

      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === "text" && parsed.content) {
          setDescription((prev) => prev + parsed.content)
        }
      } catch (err) {
        console.error("Failed to parse event data packet:", err)
      }
    }

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsGenerating(false)
        eventSourceRef.current = null
      } else {
        toast.error("Failed to generate job description. Please try again.")
        eventSource.close()
        eventSourceRef.current = null
        setIsGenerating(false)
      }
    }
  }

  /**
   * Aborts the active EventSource stream.
   */
  const handleAbortGeneration = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsGenerating(false)
      toast.info("Generation cancelled")
    }
  }

  /**
   * Persists the final configuration to the database.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, description, characterId, type }),
      })

      if (!response.ok) throw new Error("Failed to create interview")

      setIsSubmitting(false)
      router.push("/interviews") // Redirect to dashboard
    } catch (error) {
      console.error("Submission error:", error)
      toast.error("Failed to create interview. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Navigation Header */}
        <div className="flex items-center gap-4">
          <Link href="/interviews">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <IconArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Create Interview
            </h1>
            <p className="text-muted-foreground mt-1">
              Set up a new interview session. An AI interviewer will be
              automatically assigned.
            </p>
          </div>
        </div>

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Step 1: Core Job Identity */}
          <div className="space-y-4">
            <Label htmlFor="jobTitle" className="text-lg font-semibold">
              Job title
            </Label>
            <Input
              id="jobTitle"
              name="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Frontend Developer"
              className="h-12 bg-muted/20 border-muted/50"
              required
            />
          </div>

          {/* Step 2: Personality selection via VoicePicker */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">
              Select AI Interviewer
            </Label>
            <VoicePicker
              voices={CHARACTERS}
              value={characterId}
              onValueChange={setCharacterId}
              placeholder="Choose an interviewer..."
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              Tip: You can preview their voices by hovering over their avatars
              and clicking play.
            </p>
          </div>

          {/* Step 3: Interview Logic/Framework Focus */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Interview Type</Label>
            <RadioGroup
              value={type}
              onValueChange={setType}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Behavioral Focus */}
              <div className="relative">
                <RadioGroupItem
                  value="GENERAL"
                  id="general"
                  className="sr-only"
                />
                <Label
                  htmlFor="general"
                  className={cn(
                    "relative flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer bg-muted/10 overflow-hidden group",
                    type === "GENERAL"
                      ? "bg-primary/5 border-primary/50 ring-1 ring-primary/20 text-foreground"
                      : "border-muted/30 hover:bg-muted/20 hover:border-muted/50 text-muted-foreground",
                  )}
                >
                  <Checkbox
                    checked={type === "GENERAL"}
                    className="size-5 rounded-md pointer-events-none"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold tracking-tight">
                      General Interview
                    </span>
                    <span className="text-xs opacity-80">
                      Behavioral, cultural, and soft-skills focus.
                    </span>
                  </div>
                  {type === "GENERAL" && (
                    <div className="absolute right-0 top-0 h-full w-1 bg-primary rounded-r-2xl" />
                  )}
                </Label>
              </div>

              {/* Hard Skills Focus */}
              <div className="relative">
                <RadioGroupItem
                  value="TECHNICAL"
                  id="technical"
                  className="sr-only"
                />
                <Label
                  htmlFor="technical"
                  className={cn(
                    "relative flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer bg-muted/10 overflow-hidden group",
                    type === "TECHNICAL"
                      ? "bg-primary/5 border-primary/50 ring-1 ring-primary/20 text-foreground"
                      : "border-muted/30 hover:bg-muted/20 hover:border-muted/50 text-muted-foreground",
                  )}
                >
                  <Checkbox
                    checked={type === "TECHNICAL"}
                    className="size-5 rounded-md pointer-events-none"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold tracking-tight">
                      Technical Interview
                    </span>
                    <span className="text-xs opacity-80">
                      Coding, logic, and architecture focus.
                    </span>
                  </div>
                  {type === "TECHNICAL" && (
                    <div className="absolute right-0 top-0 h-full w-1 bg-primary rounded-r-2xl" />
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Step 4: Role Context (AI uses this to generate questions) */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-lg font-semibold">
                Paste the job description here
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Or generate job description
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={
                    isGenerating
                      ? handleAbortGeneration
                      : handleGenerateDescription
                  }
                  disabled={!isGenerating && !jobTitle.trim()}
                  className="bg-[#3D1D4C] hover:bg-[#4D2461] text-[#E0B0FF] border-none flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  <IconSparkles
                    className={cn(
                      "size-3.5 fill-[#E0B0FF]",
                      isGenerating && "animate-pulse",
                    )}
                  />
                  {isGenerating ? "Stop Generation" : "Generate"}
                </Button>
              </div>
            </div>

            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. We are seeking a React.js Developer to join our dynamic team in..."
              className="min-h-[300px] bg-muted/20 border-muted/50 p-4 resize-none"
              required
            />
          </div>

          {/* Actions: Save/Cancel */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <Link href="/interviews">
              <Button type="button" variant="outline" className="px-8">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting || isGenerating}
              className="px-8 bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? "Creating..." : "Create Interview"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
