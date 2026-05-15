/**
 * @file app/(main)/sessions/[id]/page.tsx
 * @description The session report page.
 * Displays aggregate metrics (performance scores), a detailed conversation history, and audio playback for recorded sessions.
 */

"use client"

import { useEffect, useState, use, useRef } from "react"
import Link from "next/link"
import { IconArrowLeft, IconPlayerPlay } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { motion } from "framer-motion" // For animations (gauge, fade-ins)
import { cn } from "@/lib/utils"
import {
  INTERACTION_TYPE_LABELS,
  INTERACTION_STATUS_LABELS,
} from "@/lib/constants"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getCharacter } from "@/lib/characters" // Utility to get AI persona details

/**
 * MessagePart Interface
 * Represents a single 'segment' of a message (text content OR a tool call).
 */
interface MessagePart {
  type: "text" | "tool"
  text?: string
  name?: string
  parameters?: Record<string, unknown>
  speakerName?: string
  speakerTitle?: string
  isUsersTurn?: boolean
  audio?: { url: string; publicId?: string }
}

/**
 * Message Interface
 * Represents an exchange between user and assistant.
 */
interface Message {
  role: "user" | "assistant"
  parts: string | MessagePart[] // Can be raw string or array of parts (Next.js/AI SDK pattern)
  feedback?: string // AI-generated feedback for this specific message
  // Individual metric scores for this turn
  correctness?: number
  clarity?: number
  relevance?: number
  detail?: number
  efficiency?: number
  creativity?: number
  communication?: number
  problemSolving?: number
  audioUrl?: string
}

/**
 * SessionData Interface
 * The full object returned by the /api/sessions/[id] endpoint.
 */
interface SessionData {
  id: string
  type: string
  status: string
  createdAt: string
  // Aggregate metrics for the entire session
  metrics?: {
    correctness: number
    clarity: number
    relevance: number
    detail: number
    efficiency: number
    creativity: number
    communication: number
    problemSolving: number
  }
  messages: Message[]
  duration: number
  // Contextual data depending on session type
  interview?: {
    jobTitle: string
    description: string
    type: string
    characterId?: string
  }
  debate?: {
    subject: string
    content: string | null
    judgeId: string | null
    opponentId: string | null
    opponentIds: string[]
  }
  customAgent?: {
    name: string
    instruction: string
  }
}

/**
 * MetricGauge Component
 * A circular SVG progress bar showing a percentage score for a specific metric.
 */
const MetricGauge = ({
  label,
  value = 0,
}: {
  label: string
  value?: number
}) => {
  const displayValue = value ?? 0
  const radius = 35
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayValue / 100) * circumference

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-foreground">{label}</h3>
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90">
          {/* Background Track */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Active Progress Bar */}
          <motion.circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "circOut" }}
            strokeLinecap="round"
          />
        </svg>
        {/* Centered Percentage Label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold tracking-tight">
            {displayValue}%
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * AudioPlayer Component
 * Simple button to play voice components within the transcript.
 */
const AudioPlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setIsPlaying(false)
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePlay}
      className={cn(
        "rounded-full gap-2 px-3 h-8 transition-all",
        isPlaying
          ? "bg-primary/20 text-primary border-primary/20"
          : "bg-zinc-800/50 text-zinc-400 hover:text-white",
      )}
    >
      {isPlaying ? (
        <>
          {/* Simple animated bars for playing state */}
          <div className="flex gap-0.5 items-center h-2">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 12, 4] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                className="w-0.5 bg-primary"
              />
            ))}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Playing
          </span>
        </>
      ) : (
        <>
          <IconPlayerPlay size={12} fill="currentColor" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Play Audio
          </span>
        </>
      )}
    </Button>
  )
}

/**
 * MessageContent Component
 * Renders the body of a message, handling both simple text and tool calls (like code blocks).
 */
const MessageContent = ({ parts }: { parts: MessagePart[] | string }) => {
  if (typeof parts === "string") return <span>{parts}</span>
  if (!Array.isArray(parts))
    return <span className="text-destructive">Invalid Content Format</span>

  return (
    <div className="space-y-4">
      {parts.map((part: MessagePart, i: number) => {
        if (part.type === "text") {
          return (
            <div key={i} className="space-y-2">
              <p className="whitespace-pre-wrap">{part.text}</p>
            </div>
          )
        }
        if (part.type === "tool") {
          // Special handling for the 'open_editor' tool which contains code
          if (part.name === "open_editor") {
            return (
              <div
                key={i}
                className="p-6 rounded-2xl bg-black/40 border border-zinc-800/50 group relative"
              >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge
                    variant="secondary"
                    className="text-[10px] uppercase font-bold tracking-tight bg-zinc-800 text-zinc-400 border-none"
                  >
                    Code Submission
                  </Badge>
                </div>
                <pre className="text-sm text-[#a3e635] overflow-x-auto font-mono">
                  <code>
                    {
                      (part.parameters as Record<string, unknown>)
                        ?.code as string
                    }
                  </code>
                </pre>
              </div>
            )
          }
          // Fallback for other tool calls
          return (
            <div
              key={i}
              className="p-4 rounded-xl bg-zinc-800/20 border border-zinc-700/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold text-[#a3e635] border-[#a3e635]/20"
                >
                  Tool Call: {part.name}
                </Badge>
              </div>
              <pre className="text-xs text-zinc-500 overflow-x-auto font-mono">
                {JSON.stringify(part.parameters, null, 2)}
              </pre>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

/**
 * Helper to extract speaker information from a message's parts.
 */
const getMessageMetadata = (msg: Message) => {
  const textPart = Array.isArray(msg.parts)
    ? msg.parts.find((p: MessagePart) => p.type === "text")
    : null
  if (textPart) {
    return {
      speakerName: textPart.speakerName,
      speakerTitle: textPart.speakerTitle,
      isUsersTurn: textPart.isUsersTurn,
      audioUrl: textPart.audio?.url,
    }
  }
  return {
    speakerName: msg.role === "assistant" ? "AI" : "You",
    speakerTitle: null,
    isUsersTurn: msg.role === "assistant",
    audioUrl: null,
  }
}

/**
 * ConversationList Component
 * Renders the actual transcript depending on the session type (Interviews vs Debates).
 */
const ConversationList = ({
  session,
  isDebate,
}: {
  session: SessionData
  isDebate: boolean
}) => {
  // Debate rendering: Linear list of arguments
  if (isDebate) {
    if (!session.messages || session.messages.length === 0) {
      return (
        <div className="text-muted-foreground italic bg-muted/20 rounded-xl p-8 border border-border/50 text-center">
          No debate conversation recorded yet.
        </div>
      )
    }

    return (
      <div className="space-y-12">
        {session.messages.map((msg: Message, idx: number) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "p-8 rounded-3xl border space-y-8 shadow-2xl shadow-black/20",
              msg.role === "assistant"
                ? "bg-zinc-900/10 border-zinc-800/30"
                : "bg-[#121212] border-zinc-800/50",
            )}
          >
            {(() => {
              const meta = getMessageMetadata(msg)
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">
                      {meta.speakerName ||
                        (msg.role === "assistant" ? "AI" : "You")}
                    </h3>
                    {/* Character Title / Role badge */}
                    {meta.speakerTitle && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-black text-rose-500 border-rose-500/20 px-2 py-0"
                      >
                        {meta.speakerTitle}
                      </Badge>
                    )}
                    {meta.audioUrl && <AudioPlayer url={meta.audioUrl} />}
                  </div>
                  <div className="text-zinc-400 leading-relaxed text-lg">
                    <MessageContent parts={msg.parts} />
                  </div>
                </div>
              )
            })()}

            {/* Turn-by-turn Feedback */}
            {msg.role === "user" &&
              (msg.feedback || msg.correctness !== undefined) && (
                <div className="space-y-4 pt-4 border-t border-zinc-800/30">
                  <h4 className="text-lg font-bold text-[#a3e635]">Feedback</h4>
                  {msg.feedback && (
                    <p className="text-zinc-400 leading-relaxed text-lg whitespace-pre-wrap">
                      {msg.feedback}
                    </p>
                  )}

                  {/* Visual score labels for this turn */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {[
                      { label: "Correctness", val: msg.correctness },
                      { label: "Clarity", val: msg.clarity },
                      { label: "Relevance", val: msg.relevance },
                      { label: "Detail", val: msg.detail },
                      { label: "Efficiency", val: msg.efficiency },
                      { label: "Creativity", val: msg.creativity },
                      { label: "Communication", val: msg.communication },
                      { label: "Problem-solving", val: msg.problemSolving },
                    ].map((m, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded-lg bg-[#2a1a1c] border border-rose-500/20 flex items-center"
                      >
                        <span className="text-[#fb7185] text-xs font-bold whitespace-nowrap">
                          {m.label} {m.val ?? 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </motion.div>
        ))}
      </div>
    )
  }

  // Interview/AI Persona rendering: Question & Answer pairs
  const interchanges: { question?: MessagePart[]; answer: Message }[] = []
  let accumulatedAssistant: MessagePart[] = []

  // Group messages into Q&A clusters
  session.messages?.forEach((msg: Message) => {
    if (msg.role === "assistant") {
      if (Array.isArray(msg.parts)) {
        accumulatedAssistant.push(...msg.parts)
      } else {
        accumulatedAssistant.push({ type: "text", text: msg.parts })
      }
    } else if (msg.role === "user") {
      interchanges.push({
        question:
          accumulatedAssistant.length > 0
            ? [...accumulatedAssistant]
            : undefined,
        answer: msg,
      })
      accumulatedAssistant = []
    }
  })

  const finalComment =
    accumulatedAssistant.length > 0 ? accumulatedAssistant : undefined

  if (interchanges.length === 0 && !finalComment) {
    return (
      <div className="text-muted-foreground italic bg-muted/20 rounded-xl p-8 border border-border/50 text-center">
        No conversation recorded yet.
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {interchanges.map((pair, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="p-8 rounded-3xl bg-[#121212] border border-zinc-800/50 space-y-8 shadow-2xl shadow-black/20"
        >
          {/* AI Question Section */}
          {pair.question && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Question: {idx + 1}
                </h3>
              </div>
              <div className="text-zinc-400 leading-relaxed text-lg">
                <MessageContent parts={pair.question} />
              </div>
            </div>
          )}

          {/* User Answer Section */}
          <div className="space-y-3">
            {(() => {
              const meta = getMessageMetadata(pair.answer)
              return (
                <>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">
                      {meta.speakerName || "Answer"}
                    </h3>
                    {meta.audioUrl && <AudioPlayer url={meta.audioUrl} />}
                  </div>
                  <div className="text-zinc-400 leading-relaxed text-lg">
                    <MessageContent parts={pair.answer.parts} />
                  </div>
                </>
              )
            })()}
          </div>

          {/* Turn Feedback/Scores */}
          {(pair.answer.feedback || pair.answer.correctness !== undefined) && (
            <div className="space-y-4 pt-4">
              <h4 className="text-lg font-bold text-[#a3e635]">Feedback</h4>
              {pair.answer.feedback && (
                <p className="text-zinc-400 leading-relaxed text-lg whitespace-pre-wrap">
                  {pair.answer.feedback}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {[
                  { label: "Correctness", val: pair.answer.correctness },
                  { label: "Clarity", val: pair.answer.clarity },
                  { label: "Relevance", val: pair.answer.relevance },
                  { label: "Detail", val: pair.answer.detail },
                  { label: "Efficiency", val: pair.answer.efficiency },
                  { label: "Creativity", val: pair.answer.creativity },
                  { label: "Communication", val: pair.answer.communication },
                  { label: "Problem-solving", val: pair.answer.problemSolving },
                ].map((m, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-[#2a1a1c] border border-rose-500/20 flex items-center"
                  >
                    <span className="text-[#fb7185] text-xs font-bold whitespace-nowrap">
                      {m.label} {m.val ?? 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}

      {/* Trailing AI comment if the user hasn't replied yet */}
      {finalComment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-3xl bg-muted/20 border border-zinc-800/50"
        >
          <div className="text-zinc-400 leading-relaxed text-lg">
            <MessageContent parts={finalComment} />
          </div>
        </motion.div>
      )}
    </div>
  )
}

/**
 * SessionPage Component
 * Main layout for the session report.
 */
export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params) // Consume the dynamic route param
  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Fetch full session details on mount.
   */
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${id}`)
        if (!response.ok) throw new Error("Failed to fetch session")
        const data = await response.json()
        setSession(data)
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSession()
  }, [id])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground animate-pulse">Loading report...</p>
      </div>
    )
  }

  // Not found fallback
  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground text-lg">Session not found</p>
        <Link href="/sessions">
          <Button variant="outline">Back to Sessions</Button>
        </Link>
      </div>
    )
  }

  // Session Helper Booleans
  const isInterview = session.type === "interview"
  const isDebate = session.type === "debate"
  const isAiPersona = session.type === "ai-persona"
  const isCompleted = session.status.toUpperCase() === "COMPLETED"

  const title = isInterview
    ? session.interview?.jobTitle
    : isDebate
      ? session.debate?.subject
      : session.customAgent?.name

  const backLink = "/sessions"
  const backLabel = "Back to Sessions"

  const runPath = `/sessions/${session.id}/run`

  return (
    <div className="flex flex-1 flex-col p-8 max-w-6xl mx-auto w-full gap-8">
      {/* Back Button */}
      <Link
        href={backLink}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <IconArrowLeft size={20} />
        <span>{backLabel}</span>
      </Link>

      {/* Header with Title and Status */}
      <div className="w-full flex items-center justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {/* Persona Avatar (if Interview) */}
            {isInterview && session.interview?.characterId && (
              <Avatar className="h-12 w-12 border">
                <AvatarImage
                  src={getCharacter(session.interview.characterId)?.avatar}
                />
                <AvatarFallback className="font-bold flex items-center justify-center p-0 scale-75">
                  {getCharacter(session.interview.characterId)?.firstName?.[0]}
                </AvatarFallback>
              </Avatar>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <Badge
              variant={isCompleted ? "default" : "secondary"}
              className={
                isCompleted
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1"
                  : ""
              }
            >
              {INTERACTION_STATUS_LABELS[
                session.status.toUpperCase().replace(/\s/g, "_")
              ] || session.status}
            </Badge>
            <Badge variant="outline">
              {INTERACTION_TYPE_LABELS[
                session.type.toUpperCase().replace("-", "_")
              ] || session.type}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <p className="text-lg">
              {formatDistanceToNow(new Date(session.createdAt), {
                addSuffix: true,
              })}
            </p>
            <div className="h-4 w-px bg-muted" />
            <p className="text-lg font-mono">
              Duration: {Math.floor(session.duration / 60)}m{" "}
              {session.duration % 60}s
            </p>
          </div>
        </div>

        {/* Continue Button: shown if session is still in progress */}
        {!isCompleted && (
          <Link href={runPath}>
            <Button className="bg-primary hover:bg-primary/90 px-8">
              Continue{" "}
              {isInterview ? "Interview" : isDebate ? "Debate" : "Session"}
            </Button>
          </Link>
        )}
      </div>

      <div className="w-full h-px bg-muted/50" />

      {/* Aggregate Score Gauges */}
      {(isInterview || isDebate || isAiPersona) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-16">
            <MetricGauge
              label="Correctness"
              value={session.metrics?.correctness}
            />
            <MetricGauge label="Clarity" value={session.metrics?.clarity} />
            <MetricGauge label="Relevance" value={session.metrics?.relevance} />
            <MetricGauge label="Detail" value={session.metrics?.detail} />
            <MetricGauge
              label="Efficiency"
              value={session.metrics?.efficiency}
            />
            <MetricGauge
              label="Creativity"
              value={session.metrics?.creativity}
            />
            <MetricGauge
              label="Communication"
              value={session.metrics?.communication}
            />
            <MetricGauge
              label="Problem Solving"
              value={session.metrics?.problemSolving}
            />
          </div>
          <div className="w-full h-px bg-muted/30 my-8" />
        </>
      )}

      {/* Conversation Transcript Section */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">
          {isInterview ? "Interview" : isDebate ? "Debate" : "Persona"}{" "}
          conversation
        </h2>

        <div className="space-y-12">
          <ConversationList session={session} isDebate={isDebate} />
        </div>
      </div>
    </div>
  )
}
