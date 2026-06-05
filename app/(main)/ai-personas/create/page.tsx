/**
 * @file app/(main)/ai-personas/create/page.tsx
 * @description The AI Persona Creation workspace.
 * Features a 'Magic Builder' that uses AI to draft persona identities based on goals,
 * along with integrated AI image generation for custom avatars.
 */

"use client"

import { useRef, useEffect, useState } from "react"
import Image from "next/image"
import {
  IconRobot,
  IconArrowLeft,
  IconSparkles,
  IconLoader2,
  IconUpload,
  IconPhoto,
  IconRefresh,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CHARACTERS } from "@/lib/characters"
// Component for picking AI Character with voice samples
import { VoicePicker } from "@/components/ui/voice-picker"
// Utility for uploading images to S3
import { uploadToS3Client } from "@/lib/s3-client"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

/**
 * Suggested prompts to help users start designing their persona.
 */
const AGENT_GOAL_PROMPTS = [
  "A cooking assistant that guides me through recipes step-by-step while I'm in the kitchen.",
  "A language tutor for practicing Spanish through interactive dialogue and roleplay.",
  "A meditation guide that leads 10-minute mindfulness sessions with a soothing tone.",
  "A storytelling companion that narrates interactive adventures for children.",
  "A focus assistant that helps me manage my deep work sessions with scheduled prompts.",
  "A fitness instructor that motivates me and tracks progress during high-intensity training.",
  "A professional interview coach for practicing responses to behavioral and technical questions.",
  "A translator for navigating conversations and understanding local nuances in foreign countries.",
  "A news curator that provides personalized briefings and insights on current events.",
  "A smart concierge that coordinates my daily schedule, reminders, and personal logistics.",
  "A debating partner for sharpening my oral arguments and public speaking skills.",
  "A customer success mentor for practicing empathy and resolving complex conflicts.",
  "A personal architect that transcribes and organizes my thoughts into structured project plans.",
  "A sales strategist for practicing pitches and handling live customer objections.",
  "A travel guide that brings historical sites to life with immersive narration.",
]

/**
 * CreateCustomAgentPage Component
 * Orchestrates the multi-step design of a custom AI personality.
 */
export default function CreateCustomAgentPage() {
  const [loading, setLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Persona Metadata States
  const [name, setName] = useState("")
  const [instruction, setInstruction] = useState("")
  const [aiPrompt, setAiPrompt] = useState("") // User's high-level goal
  const [characterId, setCharacterId] = useState<string>("aoede")
  const [avatar, setAvatar] = useState<{
    url: string
    path: string
  } | null>(null)

  // Avatar Generation States
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [tempGeneratedAvatar, setTempGeneratedAvatar] = useState<{
    url: string
    path: string
  } | null>(null)
  const [customAvatarPrompt, setCustomAvatarPrompt] = useState("")

  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [generateAbortController, setGenerateAbortController] =
    useState<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  /**
   * Selection of random prompt ideas on mount.
   */
  useEffect(() => {
    const shuffled = [...AGENT_GOAL_PROMPTS].sort(() => 0.5 - Math.random())
    setSuggestedPrompts(shuffled.slice(0, 3))
  }, [])

  /**
   * Cleanup: Ensure any pending AI generations are aborted if the user leaves the page.
   */
  useEffect(() => {
    return () => {
      if (generateAbortController) generateAbortController.abort()
    }
  }, [generateAbortController])

  /**
   * Submits the persona configuration to the backend.
   */
  const handleCreate = async () => {
    if (!name || !instruction) {
      toast.error("Please fill in all fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/ai-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          instruction,
          characterId,
          avatar,
        }),
      })

      if (!response.ok) throw new Error("Failed to create agent")

      const agent = await response.json()
      toast.success("AI Persona created successfully")
      router.push(`/ai-personas/${agent.id}`) // View the new persona
      router.refresh()
    } catch (error) {
      console.error("Creation error:", error)
      toast.error("Failed to create agent")
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handles local file selection for the persona avatar.
   */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const toastId = toast.loading("Uploading avatar...")
    try {
      // 1. Upload to S3 directly via presigned URL utility
      const path = await uploadToS3Client(file, "avatars")

      // 2. Resolve to a temporary signed URL for local preview
      const res = await fetch(
        `/api/s3/signed-url?path=${encodeURIComponent(path)}`,
      )
      const { url } = await res.json()

      setAvatar({ path, url })
      toast.success("Avatar uploaded!", { id: toastId })
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload avatar", { id: toastId })
    }
  }

  const handleOpenAvatarDialog = () => {
    if (!name || !aiPrompt || !instruction) {
      toast.error("Please fill name, goal, and instructions first")
      return
    }
    setTempGeneratedAvatar(null)
    setCustomAvatarPrompt("")
    setShowAvatarDialog(true)
  }

  /**
   * AI Avatar Generation
   * Uses the persona's identity to generate a relevant visual representation.
   */
  const handleGenerateAvatar = async () => {
    setIsGeneratingAvatar(true)
    setTempGeneratedAvatar(null)

    try {
      const response = await fetch("/api/ai-personas/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          goal: aiPrompt,
          instruction,
          customPrompt: customAvatarPrompt,
        }),
      })

      if (!response.ok) throw new Error("Avatar generation failed")

      const data = await response.json()
      // data contains { path, url } where url is a temporary signed AWS URL
      setTempGeneratedAvatar(data)
    } catch (error) {
      console.error("Avatar Gen Error:", error)
      toast.error("Failed to generate avatar")
    } finally {
      setIsGeneratingAvatar(false)
    }
  }

  /**
   * Magic Builder Logic
   * Uses an LLM to take a simple goal like "A fitness coach" and expand it into
   * a structured name, set of instructions, and voice model.
   */
  const handleAiGenerate = async () => {
    // If already generating, clicking again stops the process
    if (isGenerating && generateAbortController) {
      generateAbortController.abort()
      setGenerateAbortController(null)
      setIsGenerating(false)
      return
    }

    if (!aiPrompt) {
      toast.error("Please describe what you want the agent to do first.")
      return
    }

    const controller = new AbortController()
    setGenerateAbortController(controller)
    setIsGenerating(true)

    try {
      const response = await fetch("/api/ai-personas/generate-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Generation failed")

      const data = await response.json()
      // Apply the AI's suggestions to the form fields
      setName(data.name)
      setInstruction(data.instruction)
      if (data.characterId) {
        setCharacterId(data.characterId)
      }
      toast.success("Agent profile generated with AI!")
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info("Generation cancelled")
      } else {
        console.error("AI Generation error:", error)
        toast.error("Failed to generate agent info")
      }
    } finally {
      setIsGenerating(false)
      setGenerateAbortController(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6 max-w-4xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/ai-personas">
          <Button variant="ghost" size="icon">
            <IconArrowLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create AI Persona
          </h1>
          <p className="text-muted-foreground mt-1">
            Design your own specialized AI persona with custom capabilities.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* AI-Powered 'Magic Builder' Tooltip/Card */}
          <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <IconSparkles size={80} className="text-primary" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSparkles className="size-5 text-primary" />
                AI-Powered Builder
              </CardTitle>
              <CardDescription>
                Describe your goal and let AI draft the agent&apos;s identity
                and instructions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-goal">
                    What is this agent&apos;s goal?
                  </Label>
                </div>
                <Textarea
                  id="ai-goal"
                  placeholder="e.g., A personal voice tutor that helps me practice spoken Spanish through interactive one-to-one conversation."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="bg-background/50 resize-none h-24"
                />
                {/* Clickable Suggestion Chips */}
                <div className="flex flex-col gap-2 pt-2">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiPrompt(prompt)}
                      className="text-[11px] font-semibold tracking-tight px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/10 text-primary/70 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-all text-left w-full"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handleAiGenerate}
                  className="w-full gap-2 mt-2 bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 shadow-sm"
                  variant="outline"
                  disabled={loading}
                >
                  {isGenerating ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconSparkles className="size-4" />
                  )}
                  {isGenerating
                    ? "Generating with Magic"
                    : "Generate with Magic"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Core Configuration Form */}
          <Card className="border-primary/20 shadow-lg shadow-primary/5 bg-background/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Persona Identity</CardTitle>
              <CardDescription>
                Define how your persona identifies and its core mission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Persona Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., UI Architect / Research Assistant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Voice Selection</Label>
                <VoicePicker
                  voices={CHARACTERS}
                  value={characterId}
                  onValueChange={setCharacterId}
                  placeholder="Choose a voice model..."
                  className="h-12 bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground font-medium">
                  Defines the AI&apos;s vocal characteristics and base tone.
                </p>
              </div>

              {/* Advanced Persona Logic (System Prompt) */}
              <div className="space-y-2">
                <Label htmlFor="instruction">Instructions & Capabilities</Label>
                <Textarea
                  id="instruction"
                  placeholder="Describe what the persona should do. You can specify that it has access to UI generation and dialog management..."
                  className="min-h-[250px] bg-background/50 resize-none"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Detailed instructions help the persona understand complex
                  tasks like generating UI or managing dialogs.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-primary">
                Capabilities Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                By default, your AI persona will have access to context-aware
                tools including dialog management and real-time UI rendering.
                Use the instructions above to define when and how it should use
                these tools.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Avatar & Summary Preview */}
        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-xs font-bold tracking-widest text-primary/70">
                Persona Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              {/* Hidden file input for manual avatar upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                className="hidden"
                accept="image/*"
              />
              <div
                className="size-24 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatar ? (
                  <Image
                    src={avatar.url}
                    fill
                    className="object-cover"
                    alt="Preview"
                  />
                ) : (
                  <IconRobot className="size-10 text-primary" />
                )}

                {/* Upload Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconUpload className="text-white size-6" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-xl">
                  {name || "Unnamed Persona"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {avatar ? "Custom Avatar" : "AI Persona"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="mt-2 bg-primary/10 text-primary border-primary/20"
              >
                Active • Private
              </Badge>

              {/* Dynamic Action: Image Generation flow */}
              {name && aiPrompt && instruction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-4"
                  onClick={handleOpenAvatarDialog}
                  disabled={isGeneratingAvatar}
                >
                  <IconPhoto className="size-4" />
                  Generate Avatar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* AI Avatar Generation Dialog */}
          <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border bg-background shadow-2xl">
              <div className="p-6 space-y-6">
                <div className="space-y-1">
                  {/* Context-aware title */}
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    Generate avatar
                  </DialogTitle>
                  <p className="text-sm text-zinc-500">
                    Define the visual identity for {name || "your agent"}.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Visual Preview Area during generation */}
                  {(isGeneratingAvatar || tempGeneratedAvatar) && (
                    <div className="flex justify-center">
                      {isGeneratingAvatar ? (
                        /* Loading Spinner with drafted state */
                        <div className="size-48 rounded-lg bg-muted flex flex-col items-center justify-center gap-3 animate-pulse border border-border">
                          <IconLoader2 className="size-8 animate-spin text-muted-foreground/40" />
                          <span className="text-[10px] tracking-widest text-muted-foreground font-bold">
                            DRAFTING...
                          </span>
                        </div>
                      ) : (
                        tempGeneratedAvatar && (
                          /* Render generated result */
                          <div className="size-48 rounded-lg overflow-hidden border border-border shadow-lg relative group">
                            <Image
                              src={tempGeneratedAvatar.url}
                              fill
                              className="object-cover"
                              alt="Generated"
                            />
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Prompt refinement for the image generator */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="customAvatarPrompt"
                        className="text-xs text-muted-foreground"
                      >
                        Behavioral visual prompt (optional)
                      </Label>
                      <Input
                        id="customAvatarPrompt"
                        placeholder="e.g. Minimalist robot, purple neon, cyber-organic..."
                        className="bg-muted/50 border-input h-10 text-sm focus-visible:ring-primary/20"
                        value={customAvatarPrompt}
                        onChange={(e) => setCustomAvatarPrompt(e.target.value)}
                        disabled={isGeneratingAvatar}
                      />
                    </div>

                    <Button
                      className="w-full gap-2 font-semibold"
                      onClick={handleGenerateAvatar}
                      disabled={isGeneratingAvatar}
                    >
                      {tempGeneratedAvatar ? (
                        <IconRefresh className="size-4" />
                      ) : (
                        <IconSparkles className="size-4" />
                      )}
                      {tempGeneratedAvatar
                        ? "Regenerate avatar"
                        : "Generate visuals"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Confirm Selection */}
              {tempGeneratedAvatar && !isGeneratingAvatar && (
                <div className="px-6 pb-6 pt-2 flex justify-end">
                  <Button
                    className="w-full sm:w-auto font-bold"
                    onClick={() => {
                      setAvatar(tempGeneratedAvatar)
                      setShowAvatarDialog(false)
                    }}
                  >
                    Apply avatar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Primary Save Action */}
          <Button
            className="w-full h-12 text-lg font-semibold shadow-xl shadow-primary/20 gap-2"
            size="lg"
            disabled={loading || isGenerating}
            onClick={handleCreate}
          >
            {loading ? (
              <>
                <IconLoader2 className="size-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <IconSparkles className="size-5" />
                Build Persona
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
