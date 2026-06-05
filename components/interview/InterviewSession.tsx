"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconX,
  IconWaveSine,
  IconPlayerStopFilled,
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconCode,
  IconTerminal,
  IconSun,
  IconMoon,
  IconSparkles,
  IconLoader2,
  IconInfoCircle,
  IconMessages,
} from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { cpp } from "@codemirror/lang-cpp"
import { githubLight, githubDark } from "@uiw/codemirror-theme-github"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { type Character, getCharacter } from "@/lib/characters"
import ReactMarkdown from "react-markdown"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AgentInteraction, AuthUser, Message, MessagePart } from "@/types/features"

interface InterviewSessionProps {
  id: string
  session: AgentInteraction & {
    messages: Message[]
    duration: number
    status: string
  }
  authSession: { user: AuthUser } | null
}

export default function InterviewSession({
  id,
  session: initialSession,
  authSession,
}: InterviewSessionProps) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState<Message[]>(
    initialSession.messages || [],
  )
  const [interviewer, setInterviewer] = useState<Character | undefined>(
    undefined,
  )
  const [isRecording, setIsRecording] = useState(false)
  const transcriptRef = useRef("")
  const [isThinking, setIsThinking] = useState(
    initialSession.messages.length === 0,
  )
  const [isAiTalking, setIsAiTalking] = useState(false)
  const [isUserTalking, setIsUserTalking] = useState(false)
  const [isUsersTurn, setIsUsersTurn] = useState(false)
  const [isAiStreaming, setIsAiStreaming] = useState(false)
  const [showAiSuggestion, setShowAiSuggestion] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [codingChallenge, setCodingChallenge] = useState<{
    title: string
    description: string
    initialCode: string
    language: "javascript" | "python" | "cpp"
  } | null>(null)
  const [isCodingModalOpen, setIsCodingModalOpen] = useState(false)
  const [currentCode, setCurrentCode] = useState("")
  const [timer, setTimer] = useState(initialSession.duration || 0)
  const timerRef = useRef(timer)
  const { theme, setTheme } = useTheme()
  const [liveTranscript, setLiveTranscript] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Modal State for generic messages
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalContent, setModalContent] = useState("")

  const isInitialized = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isMutedRef = useRef(false)
  const isPausedRef = useRef(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const fluxWsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const [isGeneratingSolution, setIsGeneratingSolution] = useState(false)
  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const connectionAttemptRef = useRef<number>(0)
  const lastPartialRef = useRef("")
  const solutionAbortControllerRef = useRef<AbortController | null>(null)

  const fetchAsrToken = useCallback(async () => {
    try {
      const res = await fetch("/api/asr/token")
      if (!res.ok) throw new Error("Failed to get ASR token")
      const { token } = await res.json()
      return token
    } catch (e) {
      console.error("ASR Token Error:", e)
      return null
    }
  }, [])

  const stopFluxAsr = useCallback(() => {
    setIsConnecting(false)
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (fluxWsRef.current) {
      fluxWsRef.current.close()
      fluxWsRef.current = null
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const stopAll = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
    stopFluxAsr()
    setIsRecording(false)
    setIsAiTalking(false)
    setIsThinking(false)
    setIsUserTalking(false)
    setIsAiStreaming(false)
  }, [stopFluxAsr])

  const handleExit = useCallback(
    (path: string) => {
      stopAll()
      router.push(path)
    },
    [stopAll, router],
  )

  const handleToolCalls = useCallback((toolCalls: MessagePart[]) => {
    toolCalls.forEach((tc: MessagePart) => {
      const name = tc.name || tc.tool?.name
      const parameters = (tc.parameters || tc.tool?.parameters) as Record<
        string,
        unknown
      >

      if (name === "openCodeEditor") {
        const params = parameters as {
          title?: string
          description?: string
          code?: string
          language?: "javascript" | "python" | "cpp"
        }
        setCodingChallenge({
          title: params.title || "Code Challenge",
          description: params.description || "",
          initialCode: params.code || "",
          language: params.language || "javascript",
        })
        setCurrentCode(params.code || "")
        setIsCodingModalOpen(true)
      } else if (name === "openModal") {
        const params = parameters as { title?: string; content?: string }
        setModalTitle(params.title || "Notification")
        setModalContent(params.content || "Please see the instructions below.")
        setIsModalOpen(true)
      }
    })
  }, [])

  const handleAiSolution = async () => {
    if (!codingChallenge) return

    if (isGeneratingSolution) {
      if (solutionAbortControllerRef.current) {
        solutionAbortControllerRef.current.abort()
      }
      setIsGeneratingSolution(false)
      return
    }

    setIsGeneratingSolution(true)
    solutionAbortControllerRef.current = new AbortController()

    try {
      const res = await fetch("/api/ai/solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: codingChallenge.title,
          description: codingChallenge.description,
          language: codingChallenge.language,
          currentCode,
        }),
        signal: solutionAbortControllerRef.current.signal,
      })
      if (!res.ok) throw new Error("Failed to generate solution")
      const result = await res.json()
      if (result.solution) {
        setCurrentCode(result.solution)
        toast.success("Solution generated and applied.")
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.log("Solution generation aborted")
        return
      }
      console.error("AI solution error:", err)
      toast.error("Could not generate solution.")
    } finally {
      setIsGeneratingSolution(false)
    }
  }

  const fetchAiResponse = useCallback(
    async (
      history: Message[],
      code?: string,
      audioUrl?: string,
      audioPath?: string,
    ) => {
      try {
        if (abortControllerRef.current) abortControllerRef.current.abort()
        abortControllerRef.current = new AbortController()

        const response = await fetch(`/api/sessions/${id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            code,
            duration: timerRef.current,
            audioUrl,
            audioPath,
          }),
          signal: abortControllerRef.current.signal,
        })
        if (!response.ok) throw new Error("Failed to fetch AI response")
        const data = await response.json()
        const toolCalls =
          data.parts?.filter((p: MessagePart) => p.type === "tool") || []
        if (toolCalls.length > 0) {
          handleToolCalls(toolCalls)
        }

        if (data.status === "COMPLETED" || data.status === "Completed") {
          setSession((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev))
        }

        const textPart = data.parts?.find((p: MessagePart) => p.type === "text")

        return {
          text: textPart?.text || "",
          isCompleted:
            data.status === "COMPLETED" || data.status === "Completed",
          audioUrl: textPart?.audio?.url,
          audioPath: textPart?.audio?.path,
          speakerName: textPart?.speakerName || "Agent",
          speakerTitle: textPart?.speakerTitle || "Interviewer",
          isUsersTurn: textPart?.isUsersTurn ?? true,
          toolCalls: toolCalls as MessagePart[],
          userMsgId: data.userMessageId,
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError")
          return "AbortError"
        console.error("AI Error:", error)
        return null
      }
    },
    [id, handleToolCalls],
  )

  const speak = useCallback(
    async (
      text: string,
      isCompleted: boolean = false,
      audioUrl?: string,
      setTurnAtEnd: boolean = true,
    ) => {
      if (audio) {
        audio.pause()
        audio.src = ""
      }

      try {
        setIsThinking(true)
        if (!audioUrl) return
        const url = audioUrl
        const newAudio = new Audio(url)

        newAudio.onplay = () => {
          setIsAiTalking(true)
          setIsThinking(false)
        }

        newAudio.onended = () => {
          setIsAiTalking(false)
          setIsThinking(false)
          if (setTurnAtEnd) setIsUsersTurn(true)
          if (!audioUrl && url) URL.revokeObjectURL(url)

          if (isCompleted) {
            handleExit(`/sessions/${id}`)
          }
        }

        audioRef.current = newAudio
        setAudio(newAudio)
        newAudio.play().catch((err) => {
          if (err.name === "AbortError") return
          console.error("Play error:", err)
          setIsAiTalking(false)
          setIsThinking(false)
        })
      } catch (error) {
        console.error("Speech error:", error)
        setIsAiTalking(false)
        setIsThinking(false)
      }
    },
    [audio, id, handleExit],
  )

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (session?.status !== "COMPLETED") {
      interval = setInterval(() => {
        setTimer((prev) => {
          const next = prev + 1
          timerRef.current = next
          return next
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [session?.status])

  // Sync refs with state
  useEffect(() => {
    isMutedRef.current = isMuted
    isPausedRef.current = isPaused
  }, [isMuted, isPaused])

  // Initial Logic
  useEffect(() => {
    if (isInitialized.current && messages.length > 0) return

    const charId = session.interview?.characterId || "sarah"
    setInterviewer(getCharacter(charId))

    if (messages.length > 0) {
      isInitialized.current = true
      const lastMsg = messages[messages.length - 1]
      setIsUsersTurn(lastMsg.role === "assistant") // Default assumption if history exists
      if (lastMsg.role === "assistant") {
        const textPart = Array.isArray(lastMsg.parts)
          ? (lastMsg.parts as MessagePart[]).find((p) => p.type === "text")
          : null
        const audioUrl =
          textPart?.audio?.url ||
          (lastMsg as Message & { audioUrl?: string }).audioUrl

        const toolCalls = Array.isArray(lastMsg.parts)
          ? (lastMsg.parts as MessagePart[]).filter((p) => p.type === "tool")
          : []

        if (toolCalls.length > 0) {
          handleToolCalls(toolCalls)
        }

        const textToSpeak =
          textPart?.text ||
          (typeof lastMsg.parts === "string" ? lastMsg.parts : "")

        speak(
          textToSpeak,
          lastMsg.status === "COMPLETED" || lastMsg.status === "Completed",
          audioUrl,
        )
      }
    } else {
      // AI Starts first if no history
      const startInteraction = async () => {
        setIsThinking(true)
        const aiResponse = await fetchAiResponse([])

        // If aborted, don't do anything as a second request is likely coming
        if (aiResponse === "AbortError") return

        if (aiResponse && typeof aiResponse !== "string") {
          isInitialized.current = true
          const assistantMsg: Message = {
            role: "assistant",
            parts: [
              {
                type: "text" as const,
                text: aiResponse.text,
                speakerName: aiResponse.speakerName,
                speakerTitle: aiResponse.speakerTitle,
                isUsersTurn: !!aiResponse.isUsersTurn,
                audio: {
                  path: aiResponse.audioPath,
                  url: aiResponse.audioUrl || null,
                },
              },
              ...(aiResponse.toolCalls
                ? (aiResponse.toolCalls as MessagePart[]).map(
                    (tc: MessagePart) => ({
                      type: "tool" as const,
                      name: (tc.name || tc.tool?.name || "") as string,
                      parameters: (tc.parameters ||
                        tc.tool?.parameters ||
                        {}) as Record<string, unknown>,
                    }),
                  )
                : []),
            ],
          }
          setMessages([assistantMsg])
          setIsUsersTurn(!!aiResponse.isUsersTurn)
          speak(
            aiResponse.text,
            aiResponse.isCompleted,
            aiResponse.audioUrl,
            !!aiResponse.isUsersTurn,
          )
        } else {
          setIsThinking(false)
          setIsUsersTurn(true)
        }
      }
      startInteraction()
    }
  }, [
    messages.length,
    fetchAiResponse,
    speak,
    session.interview?.characterId,
    handleToolCalls,
    messages,
  ])

  const stopAndCancel = () => {
    connectionAttemptRef.current = 0
    setIsRecording(false)
    stopFluxAsr()
  }

  const startFluxAsr = async () => {
    const currentAttempt = connectionAttemptRef.current
    const token = await fetchAsrToken()

    if (connectionAttemptRef.current !== currentAttempt) return

    if (!token) {
      setIsConnecting(false)
      return
    }

    const workerUrl = `${process.env.NEXT_PUBLIC_FLUX_WORKER_URL || "wss://flux.leadwithshakib.workers.dev/"}?token=${token}`

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
        },
      })

      if (connectionAttemptRef.current !== currentAttempt) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      micStreamRef.current = stream
      fluxWsRef.current = new WebSocket(workerUrl)

      fluxWsRef.current.onopen = () => {
        if (connectionAttemptRef.current !== currentAttempt) {
          fluxWsRef.current?.close()
          return
        }
        setIsConnecting(false)
        setIsRecording(true)
        const audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )({ sampleRate: 16000 })
        audioContextRef.current = audioContext

        const source = audioContext.createMediaStreamSource(
          micStreamRef.current!,
        )
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e: { inputBuffer: AudioBuffer }) => {
          // Strictly check for Muted or Paused states
          if (
            fluxWsRef.current?.readyState === WebSocket.OPEN &&
            !isMutedRef.current &&
            !isPausedRef.current
          ) {
            const inputData = e.inputBuffer.getChannelData(0)
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff
            }
            fluxWsRef.current.send(pcmData.buffer)
          }
        }

        source.connect(processor)
        processor.connect(audioContext.destination)

        // Standard MediaRecorder for high quality audio file upload
        const mediaRecorder = new MediaRecorder(micStreamRef.current!)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        mediaRecorder.start()
      }

      fluxWsRef.current.onmessage = (e: { data: string }) => {
        if (isPausedRef.current) return
        try {
          const data = JSON.parse(e.data)
          if (data.transcript) {
            const clean = data.transcript.trim()
            if (clean) {
              // Heuristic: If current transcript is shorter than what we saw,
              // the worker might have reset for a new utterance without is_final: true.
              // We should commit the previous partial to the ref.
              if (
                lastPartialRef.current &&
                data.transcript.length < lastPartialRef.current.length * 0.7 &&
                !data.transcript
                  .toLowerCase()
                  .startsWith(
                    lastPartialRef.current.toLowerCase().substring(0, 5),
                  )
              ) {
                transcriptRef.current += lastPartialRef.current + " "
                lastPartialRef.current = ""
              }

              lastPartialRef.current = data.transcript
              const currentFull = (
                transcriptRef.current +
                " " +
                data.transcript
              )
                .replace(/\s+/g, " ")
                .trim()
              setLiveTranscript(currentFull)

              if (!isMutedRef.current && data.is_final) {
                transcriptRef.current =
                  (transcriptRef.current + " " + data.transcript)
                    .replace(/\s+/g, " ")
                    .trim() + " "
                lastPartialRef.current = ""
                setLiveTranscript(transcriptRef.current)
              }
            }
          }
        } catch (err) {
          console.error("ASR Data Error:", err)
        }
      }

      fluxWsRef.current.onerror = (err) => {
        console.error("ASR WS Error:", err)
        stopFluxAsr()
        setIsRecording(false)
      }
      fluxWsRef.current.onclose = () => stopFluxAsr()
    } catch (e) {
      console.error("Mic Access Error:", e)
      setIsConnecting(false)
      setIsRecording(false)
    }
  }

  const startRecording = () => {
    const attempt = Date.now()
    connectionAttemptRef.current = attempt
    setIsConnecting(true)
    transcriptRef.current = ""
    lastPartialRef.current = ""
    setLiveTranscript("")
    startFluxAsr()
  }

  const stopAndSubmit = async () => {
    setIsRecording(false)

    // Start upload in parallel
    const audioUploadPromise = (async () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        const audioPromise = new Promise<Blob>((resolve) => {
          mediaRecorderRef.current!.onstop = () => {
            const blob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            })
            resolve(blob)
          }
        })
        mediaRecorderRef.current.stop()
        const audioBlob = await audioPromise

        try {
          const { uploadToS3Client } = await import("@/lib/s3-client")
          const path = await uploadToS3Client(audioBlob, "audio")

          // Optionally get a temporary signed URL
          const res = await fetch(
            `/api/s3/signed-url?path=${encodeURIComponent(path)}`,
          )
          const { url } = await res.json()

          return { url, path } // Updated return type
        } catch (err) {
          console.error("Failed to upload user audio to S3:", err)
          return null
        }
      }
      return null
    })()

    stopFluxAsr()
    setIsMuted(false)
    setIsPaused(false)

    // Capture the final string from the display buffer
    const finalTranscriptText = (
      transcriptRef.current +
      " " +
      (lastPartialRef.current || "")
    )
      .replace(/\s+/g, " ")
      .trim()

    if (finalTranscriptText) {
      handleUserResponse(finalTranscriptText, undefined, audioUploadPromise)
    }
    transcriptRef.current = ""
    lastPartialRef.current = ""
    setLiveTranscript("")
  }

  const toggleRecording = () => {
    if (isRecording) stopAndSubmit()
    else startRecording()
  }

  const handleGenerateWithAi = async () => {
    if (isAiStreaming) return

    setIsAiStreaming(true)
    setShowAiSuggestion(true)
    setStreamedText("")
    setIsThinking(false)

    const currentAbortController = new AbortController()
    abortControllerRef.current = currentAbortController

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          candidateName: user?.name,
          interviewerName: interviewer
            ? `${interviewer.firstName} ${interviewer.lastName}`
            : "Sarah Miller",
          interviewType: session?.interview?.type,
          jobTitle: session?.interview?.jobTitle,
          jobDescription: session?.interview?.description,
          sessionType: "interview",
        }),
        signal: currentAbortController.signal,
      })

      if (!response.ok) throw new Error("Streaming failed")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          accumulated += chunk
          setStreamedText(accumulated)
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Streaming error:", error)
      }
    } finally {
      setIsAiStreaming(false)
    }
  }

  const handleCancelSuggestion = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setIsAiStreaming(false)
    setShowAiSuggestion(false)
    setStreamedText("")
  }

  const handleOpenMicFromSuggestion = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setIsAiStreaming(false)
    startRecording()
  }

  const handleUserResponse = async (
    text: string,
    code?: string,
    audioUploadPromise?: Promise<{
      url: string | null
      path: string | null
    } | null>,
  ) => {
    const userMsg: Message = {
      role: "user",
      parts: [
        {
          type: "text" as const,
          text,
          speakerName: authSession?.user?.name || "Candidate",
          speakerTitle: "Candidate",
          isUsersTurn: false,
          audio: { url: null, path: null },
        },
        ...(code
          ? ([
              {
                type: "tool" as const,
                name: "open_editor",
                parameters: { code },
              },
            ] as MessagePart[])
          : []),
      ],
    }
    const newMessages: Message[] = [...messages, userMsg]
    setMessages(newMessages)
    setShowAiSuggestion(false)
    setStreamedText("")

    setIsThinking(true)
    const aiData = await fetchAiResponse(newMessages, code)
    if (aiData === "AbortError") return

    if (aiData) {
      // Background: Handle audio update if promise exists
      if (audioUploadPromise && aiData.userMsgId) {
        audioUploadPromise.then(async (result) => {
          if (result?.url) {
            try {
              await fetch(`/api/messages/${aiData.userMsgId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audioUrl: result.url,
                  audioPath: result.path,
                }),
              })

              // Locally update messages to show audio if needed
              setMessages((prev) =>
                prev.map((m) => {
                  if (
                    m.id === aiData.userMsgId ||
                    (m.role === "user" && m.parts)
                  ) {
                    const updatedParts = m.parts.map((p) => {
                      if (p.type === "text") {
                        return {
                          ...p,
                          audio: { url: result.url, path: result.path },
                        }
                      }
                      return p
                    })
                    return { ...m, parts: updatedParts }
                  }
                  return m
                }),
              )
            } catch (err) {
              console.error("Error updating message audio in background:", err)
            }
          }
        })
      }

      const assistantMsg: Message = {
        role: "assistant",
        parts: [
          {
            type: "text" as const,
            text: aiData.text,
            speakerName: aiData.speakerName,
            speakerTitle: aiData.speakerTitle,
            isUsersTurn: !!aiData.isUsersTurn,
            audio: { url: aiData.audioUrl, path: aiData.audioPath },
          },
          ...(aiData.toolCalls
            ? aiData.toolCalls.map((tc: MessagePart) => ({
                type: "tool" as const,
                name: (tc.name || tc.tool?.name || "") as string,
                parameters: (tc.parameters ||
                  tc.tool?.parameters ||
                  {}) as Record<string, unknown>,
              }))
            : []),
        ],
      }
      setMessages([...newMessages, assistantMsg])
      setIsUsersTurn(!!aiData.isUsersTurn)
      speak(
        aiData.text,
        aiData.isCompleted,
        aiData.audioUrl,
        !!aiData.isUsersTurn,
      )
    } else {
      setIsThinking(false)
      setIsUsersTurn(true) // Allow user to try again on error
    }
  }

  useEffect(() => {
    return () => stopAll()
  }, [stopAll])

  const user = authSession?.user

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden text-foreground font-sans selection:bg-primary/30">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 h-20 px-4 md:px-8 flex items-center justify-between z-50 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => handleExit(`/sessions/${id}`)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full p-2 transition-colors shrink-0"
          >
            <IconX size={20} />
          </button>
          <div className="hidden sm:block h-4 w-px bg-border mx-2 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold flex items-center gap-2">
              <span className="truncate max-w-[120px] sm:max-w-[250px] md:max-w-none">
                {session?.interview?.jobTitle}
              </span>
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden xs:inline-block">
                {session?.interview?.type}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <IconSun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <IconMoon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full gap-2 px-2 md:px-3"
          >
            <IconMessages size={18} />
            <span className="hidden sm:inline-block text-xs font-semibold">
              History
            </span>
          </Button>
          <Button
            className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-full gap-2 px-3 md:px-6 h-9 font-mono"
            onClick={() => handleExit(`/sessions/${id}`)}
          >
            <IconPlayerStopFilled size={14} />
            <span className="text-xs md:text-sm font-bold tracking-tight">
              {Math.floor(timer / 60)}:
              {(timer % 60).toString().padStart(2, "0")}
            </span>
          </Button>

          {codingChallenge && (
            <Button
              className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full gap-2 px-4 h-9 animate-in fade-in zoom-in duration-300"
              onClick={() => setIsCodingModalOpen(true)}
            >
              <IconCode size={18} />
              <span className="text-xs font-bold">Open editor</span>
            </Button>
          )}

          {modalTitle && (
            <Button
              className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full gap-2 px-3 md:px-4 h-9 animate-in fade-in zoom-in duration-300"
              onClick={() => setIsModalOpen(true)}
            >
              <IconInfoCircle size={18} />
              <span className="hidden md:inline-block text-xs font-bold">
                Open information
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 md:p-8 lg:p-12 pt-24 md:pt-12 overflow-y-auto relative custom-scrollbar">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "min-h-[400px] md:aspect-square relative group transition-all duration-500",
              isUserTalking &&
                "ring-4 ring-emerald-500/30 rounded-[2rem] md:rounded-[2.5rem]",
            )}
          >
            <div className="absolute inset-0 bg-card/50 rounded-[2rem] md:rounded-[2.5rem] border border-border backdrop-blur-xl overflow-hidden shadow-2xl">
              <div className="size-full flex flex-col p-6 md:p-8">
                {/* Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
                  {showAiSuggestion ? (
                    <div className="w-full flex flex-col items-center justify-center h-full">
                      <div
                        className={cn(
                          "flex-1 w-full overflow-y-auto custom-scrollbar pr-2",
                          !streamedText && "flex items-center justify-center",
                        )}
                      >
                        <p
                          className={cn(
                            "text-base text-foreground font-medium leading-relaxed font-sans whitespace-pre-wrap italic text-center px-4",
                            !streamedText && "opacity-50 animate-pulse",
                          )}
                        >
                          {streamedText || "Wait, formulating arguments...."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Avatar
                          className={cn(
                            "size-32 md:size-48 rounded-[2rem] md:rounded-[2.5rem] border-2 border-border shadow-2xl transition-all duration-500",
                            isUserTalking
                              ? "ring-4 md:ring-8 ring-emerald-500/20 scale-105"
                              : "ring-4 ring-primary/20",
                          )}
                        >
                          <AvatarImage
                            src={user?.image || undefined}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-muted text-foreground text-4xl md:text-6xl font-bold rounded-[2rem] md:rounded-[2.5rem]">
                            {user?.name?.[0] || "u"}
                          </AvatarFallback>
                        </Avatar>
                        <AnimatePresence>
                          {isUserTalking && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="absolute -bottom-4 -right-4 bg-emerald-500 p-2.5 rounded-2xl shadow-xl ring-4 ring-[#09090b]"
                            >
                              <IconWaveSine
                                size={20}
                                className="text-white animate-pulse"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="mt-4 md:mt-8 text-center">
                        <h3 className="text-xl md:text-2xl font-bold tracking-tight">
                          {user?.name || "You"}
                        </h3>
                        <p className="text-muted-foreground text-xs md:text-sm mt-1 font-bold">
                          Candidate
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    "flex items-center justify-center relative transition-all duration-300",
                    showAiSuggestion ? "h-6" : "h-16",
                  )}
                >
                  {/* Redundant transcript removed */}
                </div>

                {/* Bottom Actions */}
                <div className="flex justify-center pt-2">
                  <AnimatePresence mode="wait">
                    {showAiSuggestion ? (
                      <motion.div
                        key="suggestion-actions"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="w-full flex gap-3"
                      >
                        <Button
                          onClick={handleCancelSuggestion}
                          variant="outline"
                          className="flex-1 h-11 rounded-xl border-border bg-background hover:bg-muted font-bold text-xs gap-2"
                        >
                          <IconX size={16} />
                          Cancel
                        </Button>
                        {isRecording && (
                          <>
                            <Button
                              onClick={() => setIsPaused(!isPaused)}
                              variant="outline"
                              className="size-11 rounded-xl border-border bg-background hover:bg-muted font-bold shadow-xl"
                            >
                              {isPaused ? (
                                <IconPlayerPlay size={16} />
                              ) : (
                                <IconPlayerPause size={16} />
                              )}
                            </Button>
                            <Button
                              onClick={() => setIsMuted(!isMuted)}
                              variant="outline"
                              className={cn(
                                "size-11 rounded-xl border transition-all shadow-xl",
                                isMuted
                                  ? "bg-red-500/10 border-red-500/50 text-red-500"
                                  : "bg-background border-border",
                              )}
                            >
                              {isMuted ? (
                                <IconVolumeOff size={16} />
                              ) : (
                                <IconVolume size={16} />
                              )}
                            </Button>
                          </>
                        )}
                        <Button
                          onClick={
                            isRecording
                              ? stopAndSubmit
                              : handleOpenMicFromSuggestion
                          }
                          className={cn(
                            "flex-[2] h-11 rounded-xl text-white font-bold text-xs gap-2 transition-all duration-300",
                            isRecording
                              ? "bg-red-500 hover:bg-red-600 border-red-400"
                              : "bg-emerald-600 hover:bg-emerald-700 border-emerald-500",
                          )}
                        >
                          {isRecording ? (
                            <IconMicrophoneOff size={16} />
                          ) : (
                            <IconMicrophone size={16} />
                          )}
                          {isRecording ? "Stop & submit" : "Open microphone"}
                        </Button>
                      </motion.div>
                    ) : isRecording ||
                      (isUsersTurn && !isAiTalking && !isThinking) ? (
                      <motion.div
                        layoutId="action-button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="w-full flex gap-3"
                      >
                        {!isThinking && !showAiSuggestion && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1"
                          >
                            <Button
                              onClick={handleGenerateWithAi}
                              className="w-full h-11 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs gap-2 transition-all duration-300"
                            >
                              <IconSparkles size={16} />
                              AI suggestion
                            </Button>
                          </motion.div>
                        )}

                        {isRecording && (
                          <>
                            <Button
                              onClick={() => setIsPaused(!isPaused)}
                              variant="outline"
                              className="size-11 rounded-xl border-border bg-background hover:bg-muted font-bold shadow-xl"
                            >
                              {isPaused ? (
                                <IconPlayerPlay size={16} />
                              ) : (
                                <IconPlayerPause size={16} />
                              )}
                            </Button>
                            <Button
                              onClick={() => setIsMuted(!isMuted)}
                              variant="outline"
                              className={cn(
                                "size-11 rounded-xl border transition-all shadow-xl",
                                isMuted
                                  ? "bg-red-500/10 border-red-500/50 text-red-500"
                                  : "bg-background border-border",
                              )}
                            >
                              {isMuted ? (
                                <IconVolumeOff size={16} />
                              ) : (
                                <IconVolume size={16} />
                              )}
                            </Button>
                          </>
                        )}

                        <Button
                          onClick={
                            isConnecting ? stopAndCancel : toggleRecording
                          }
                          disabled={isThinking}
                          className={cn(
                            "flex-1 h-11 rounded-xl border transition-all duration-300 font-bold text-xs gap-2",
                            isConnecting
                              ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
                              : isRecording
                                ? "bg-red-500 hover:bg-red-600 border-red-400 text-white"
                                : "bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white",
                          )}
                        >
                          {isConnecting ? (
                            <>
                              <IconLoader2 className="animate-spin" size={16} />
                              Connecting (cancel)
                            </>
                          ) : isRecording ? (
                            <>
                              <IconMicrophoneOff size={16} />
                              Stop & submit
                            </>
                          ) : (
                            <>
                              <IconMicrophone size={16} />
                              Open microphone
                            </>
                          )}
                        </Button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Live Transcription Display - Positioned at Absolute Bottom Outside All Containers */}
          <AnimatePresence>
            {isRecording && liveTranscript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-12 z-[200] pointer-events-none text-center"
              >
                <div
                  className="h-[4rem] flex flex-col justify-end overflow-hidden"
                  style={{
                    maskImage:
                      "linear-gradient(to bottom, transparent 0%, black 25%, black 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, transparent 0%, black 25%, black 100%)",
                  }}
                >
                  <p className="text-sm text-foreground font-medium tracking-tight leading-relaxed italic drop-shadow-lg origin-bottom">
                    {liveTranscript}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Square */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "min-h-[400px] md:aspect-square relative group transition-all duration-500",
              isAiTalking &&
                "ring-4 ring-primary/30 rounded-[2rem] md:rounded-[2.5rem]",
            )}
          >
            <div className="absolute inset-0 bg-card rounded-[2rem] md:rounded-[2.5rem] border border-border backdrop-blur-xl overflow-hidden shadow-2xl">
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, currentColor 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />

              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-8">
                <div className="relative">
                  <Avatar
                    className={cn(
                      "size-32 md:size-48 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl transition-all duration-500",
                      isAiTalking
                        ? "ring-4 md:ring-8 ring-primary/20 scale-105"
                        : "ring-4 ring-primary/20 whitespace-pre-wrap",
                    )}
                  >
                    <AvatarImage
                      src={interviewer?.avatar}
                      alt={
                        interviewer
                          ? `${interviewer.firstName} ${interviewer.lastName}`
                          : "AI"
                      }
                      className="w-full h-full object-cover"
                    />
                    <AvatarFallback className="text-4xl md:text-6xl font-black bg-muted text-foreground rounded-[2rem] md:rounded-[2.5rem]">
                      {interviewer?.firstName?.[0] || "A"}
                    </AvatarFallback>
                  </Avatar>

                  {isAiTalking && (
                    <div className="absolute -inset-4 rounded-[3rem] border-2 border-primary/30 animate-ping opacity-20 pointer-events-none" />
                  )}
                </div>

                <div className="mt-4 md:mt-8 text-center">
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight">
                    {interviewer
                      ? `${interviewer.firstName} ${interviewer.lastName}`
                      : "Sarah Miller"}
                  </h3>
                  <p className="text-primary/60 text-xs md:text-sm mt-1 font-bold">
                    Interviewer
                  </p>
                </div>

                <div className="absolute bottom-6 md:bottom-12 w-full flex justify-center px-6 md:px-8">
                  <AnimatePresence mode="wait">
                    {isAiTalking || isThinking ? (
                      <motion.div
                        layoutId="action-button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="w-full"
                      >
                        <Button
                          disabled
                          className="w-full h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary font-bold text-xs gap-3 opacity-100"
                        >
                          <div className="flex gap-1 items-center">
                            {[1, 2, 3].map((i) => (
                              <motion.div
                                key={i}
                                animate={{ height: [4, 10, 4] }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Infinity,
                                  delay: i * 0.1,
                                }}
                                className="w-0.5 bg-primary rounded-full"
                              />
                            ))}
                          </div>
                          <p className="text-xs font-bold text-primary/40 animate-pulse">
                            {isThinking
                              ? `${interviewer ? `${interviewer.firstName} ${interviewer.lastName}` : "Sarah Miller"} is thinking...`
                              : `${interviewer ? `${interviewer.firstName} ${interviewer.lastName}` : "Sarah Miller"} is speaking...`}
                          </p>{" "}
                        </Button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Custom Coding Modal */}
      <AnimatePresence>
        {isCodingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCodingModalOpen(false)}
              className="absolute inset-0 bg-background/60 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-[95vw] h-[90vh] bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Left Pane: Challenge Details */}
                <div className="w-full lg:w-[380px] border-b lg:border-b-0 lg:border-r border-border p-8 flex flex-col gap-6 overflow-y-auto bg-muted/5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {codingChallenge?.title || "Coding Challenge"}
                    </h2>
                    <button
                      onClick={() => setIsCodingModalOpen(false)}
                      className="lg:hidden p-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <IconX size={20} />
                    </button>
                  </div>

                  <div className="text-sm text-muted-foreground leading-relaxed font-sans prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>
                      {codingChallenge?.description || ""}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Right Pane: Editor */}
                <div className="flex-1 flex flex-col bg-background relative">
                  <div className="h-12 border-b border-border flex items-center px-6 justify-between bg-muted/5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {codingChallenge?.language} editor
                      </span>
                    </div>
                    <button
                      onClick={() => setIsCodingModalOpen(false)}
                      className="hidden lg:flex p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                    >
                      <IconX size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden p-0">
                    <CodeMirror
                      value={currentCode}
                      height="100%"
                      theme={theme === "dark" ? githubDark : githubLight}
                      extensions={[
                        codingChallenge?.language === "javascript"
                          ? javascript({ jsx: true })
                          : codingChallenge?.language === "python"
                            ? python()
                            : cpp(),
                      ]}
                      onChange={(val) => setCurrentCode(val)}
                      className="h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-20 border-t border-border px-8 flex items-center justify-between bg-muted/5">
                <Button
                  variant="outline"
                  disabled={isGeneratingSolution}
                  onClick={handleAiSolution}
                  className="font-bold text-xs h-10 px-6 gap-2 border-primary/20 hover:border-primary/40 text-primary bg-primary/5"
                >
                  {isGeneratingSolution ? (
                    <>
                      <IconLoader2 className="animate-spin" size={14} />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <IconSparkles size={14} />
                      Solution with AI
                    </>
                  )}
                </Button>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsCodingModalOpen(false)}
                    className="font-medium text-xs h-10 px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setIsCodingModalOpen(false)
                      handleUserResponse(
                        "I have completed the coding challenge. Please review my code.",
                        currentCode,
                      )
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs px-8 h-10 rounded-md shadow-sm"
                  >
                    Submit Code
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes scan {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(200%);
          }
        }
        .cm-editor {
          outline: none !important;
        }
        .cm-scroller {
          font-family: var(--font-mono) !important;
        }
      `}</style>
      {/* Generic Modal Tool */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl bg-background border-border rounded-xl p-8 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {modalTitle || "Information"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{modalContent}</ReactMarkdown>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <Button
              onClick={() => setIsModalOpen(false)}
              variant="secondary"
              className="rounded-md px-6 h-9 text-xs font-medium"
            >
              Acknowledge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent
          style={{
            width: "98vw",
            height: "95vh",
            maxWidth: "98vw",
            maxHeight: "95vh",
          }}
          className="p-0 overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl"
        >
          <DialogHeader className="p-8 border-b border-border/10 flex flex-row items-center justify-between shrink-0">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-3xl font-bold flex items-center gap-4">
                <div className="bg-primary/20 p-2 rounded-xl">
                  <IconMessages className="text-primary" size={28} />
                </div>
                Conversation history
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                Review every strategic exchange and implementation detail from
                your session.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar bg-dots-white/[0.02]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                <IconMessages size={120} stroke={0.5} />
                <p className="text-2xl font-bold">
                  Silence is all that&apos;s here...
                </p>
              </div>
            ) : (
              <div className="max-w-[95%] mx-auto w-full space-y-12">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: m.role === "user" ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex flex-col gap-4",
                      m.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {m.role !== "user" && (
                        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <IconSparkles size={14} className="text-primary" />
                        </div>
                      )}
                      <span
                        className={cn(
                          "text-xs font-bold",
                          m.role === "user"
                            ? "text-emerald-500"
                            : "text-primary",
                        )}
                      >
                        {m.role === "user"
                          ? user?.name || "Candidate"
                          : m.parts.find((p) => p.type === "text")
                              ?.speakerName ||
                            (interviewer
                              ? `${interviewer.firstName} ${interviewer.lastName}`
                              : "Sarah Miller")}
                      </span>
                      {m.role === "user" && (
                        <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <IconTerminal
                            size={14}
                            className="text-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "pt-2 pb-6 text-[15px] leading-[1.6] transition-all duration-300",
                        m.role === "user"
                          ? "text-zinc-100"
                          : "text-zinc-900 dark:text-zinc-100 border-border/50",
                      )}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none text-base">
                        <ReactMarkdown>
                          {m.parts.find((p) => p.type === "text")?.text || ""}
                        </ReactMarkdown>
                      </div>

                      {/* Code Attachment Block */}
                      {m.parts.find(
                        (p) =>
                          p.type === "tool" &&
                          (p.name === "openCodeEditor" ||
                            p.name === "open_editor"),
                      ) && (
                        <div className="mt-6 p-5 rounded-2xl bg-black/80 font-mono text-[11px] overflow-hidden border border-white/5 relative group">
                          <div className="flex items-center justify-between mb-4 opacity-50">
                            <div className="flex items-center gap-2">
                              <IconCode size={14} />
                              <span className="font-bold text-[9px]">
                                Implementation artifact
                              </span>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10">
                              {codingChallenge?.language || "typescript"}
                            </span>
                          </div>
                          <pre className="text-zinc-400 overflow-x-auto custom-scrollbar italic leading-relaxed">
                            <code>
                              {
                                m.parts.find(
                                  (p) =>
                                    p.type === "tool" &&
                                    (p.name === "openCodeEditor" ||
                                      p.name === "open_editor"),
                                )?.parameters?.code as string
                              }
                            </code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
