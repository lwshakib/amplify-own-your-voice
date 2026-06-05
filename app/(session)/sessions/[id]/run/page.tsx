/**
 * @file app/(session)/sessions/[id]/run/page.tsx
 * @description The live session simulation environment.
 * This is an orchestrator page that identifies the type of session (Interview, Debate, or AI Persona)
 * and dynamically loads the high-fidelity UI required for that practice mode.
 */

"use client"

import { useEffect, useState, use, useRef } from "react"
import dynamic from "next/dynamic" // Optimizes performance by code-splitting large session features
import { authClient } from "@/lib/auth-client"
import { AgentInteraction, Message } from "@/types/features"

/**
 * Dynamic Imports
 * These components are heavy as they include Real-time Audio, VAD (Voice Activity Detection),
 * and dynamic UI rendering. We disable SSR (ssr: false) because they access 'navigator',
 * 'window', and the Web Audio API immediately on mount.
 */
const InterviewSession = dynamic(
  () => import("@/components/interview/InterviewSession"),
  {
    ssr: false,
    loading: () => <SessionLoader label="Loading Interview Environment..." />,
  },
)
const AiPersonaSession = dynamic(
  () => import("@/components/ai-persona/AiPersonaSession"),
  {
    ssr: false,
    loading: () => <SessionLoader label="Loading AI Personality..." />,
  },
)
const DebateSession = dynamic(() => import("@/components/debate/DebateSession"), {
  ssr: false,
  loading: () => <SessionLoader label="Preparing Debate Floor..." />,
})

/**
 * Shared props interface for all specialized session types.
 * Each child component expects the same context from the orchestrator.
 */
interface SessionComponentProps {
  id: string // The specific session ID
  session: AgentInteraction & {
    messages: Message[]
    duration: number
    status: string
  } // The full session data
  authSession: {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  } | null
}

/**
 * Component Map
 * Maps normalized session string types to their respective Next.js dynamic components.
 */
const COMPONENT_MAP: Record<
  string,
  React.ComponentType<SessionComponentProps>
> = {
  INTERVIEW: InterviewSession as React.ComponentType<SessionComponentProps>,
  AI_PERSONA: AiPersonaSession as React.ComponentType<SessionComponentProps>,
  DEBATE: DebateSession as React.ComponentType<SessionComponentProps>,
}

/**
 * SessionLoader Component
 * A consistent immersive placeholder used while dynamic modules are loading.
 */
function SessionLoader({
  label = "Initializing Session...",
}: {
  label?: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center h-screen bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-medium animate-pulse tracking-wide">
          {label}
        </p>
      </div>
    </div>
  )
}

/**
 * ActiveSessionPage Component
 * The entry point for any live practice session.
 */
export default function ActiveSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Use 'use' to unwrap the dynamic route params in Next.js 15+
  const { id } = use(params)
  const { data: authSession } = authClient.useSession()

  // Storage for the fetched session metadata
  const [session, setSession] = useState<
    | (AgentInteraction & {
        messages: Message[]
        duration: number
        status: string
      })
    | null
  >(null)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Ref to track initialization status.
   * Prevents double-fetching in development environments where React Strict Mode
   * mounts components twice.
   */
  const isInitialized = useRef(false)

  /**
   * Data Fetching: Retrieve the specific session context.
   */
  useEffect(() => {
    const initSession = async () => {
      if (isInitialized.current) return
      isInitialized.current = true

      try {
        const response = await fetch(`/api/sessions/${id}`)
        if (!response.ok) throw new Error("Failed to fetch session metadata")
        const data = await response.json()
        setSession(data)
      } catch (error) {
        console.error("Session Load Error:", error)
      } finally {
        setIsLoading(false)
      }
    }
    initSession()
  }, [id])

  // Full-screen blocking loader for the data-fetching phase
  if (isLoading) {
    return <SessionLoader />
  }

  // Handle 'Not Found' or invalid session states
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center h-screen bg-zinc-950">
        <p className="text-white font-medium">
          Practice session not found or access denied.
        </p>
      </div>
    )
  }

  /**
   * Key Normalization
   * Session types might come in formats like 'ai-persona' or 'AI_PERSONA'.
   * We convert to UPPER_SNAKE_CASE to match the map keys.
   */
  const normalizedKey = session.type.replace(/-/g, "_").toUpperCase()
  const SessionComponent = COMPONENT_MAP[normalizedKey]

  /**
   * Render Strategy
   * If a match is found in our component map, we delegate the UI and logic
   * to the specialized session component.
   */
  if (SessionComponent) {
    return (
      <SessionComponent id={id} session={session} authSession={authSession} />
    )
  }

  // Fallback if the user somehow lands on an unsupported session type
  return (
    <div className="flex flex-1 items-center justify-center h-screen bg-black">
      <div className="text-center space-y-2">
        <p className="text-white font-bold text-xl uppercase tracking-widest">
          Unsupported Mode
        </p>
        <p className="text-zinc-500 text-sm italic">{session.type}</p>
      </div>
    </div>
  )
}
