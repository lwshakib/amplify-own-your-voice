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
import {
  AgentInteraction,
  AuthUser,
  Message,
  MessagePart,
} from "@/types/features"

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
  const isMutedRef = useRef(false)
  const isPausedRef = useRef(false)

  const fluxWsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const [isGeneratingSolution, setIsGeneratingSolution] = useState(false)
  const micStreamRef = useRef<MediaStream | null>(null)
  const lastPartialRef = useRef("")
  const solutionAbortControllerRef = useRef<AbortController | null>(null)

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

  // Refs for audio playback and tracking
  const playbackContextRef = useRef<AudioContext | null>(null)
  const nextPlaybackTimeRef = useRef<number>(0)
  const activePlaybackNodes = useRef<Set<AudioBufferSourceNode>>(new Set())
  const accumulatedOutputTextRef = useRef<string>("")
  const lastUserTextRef = useRef<string>("")

  const getPlaybackContext = () => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )({ sampleRate: 24000 })
    }
    return playbackContextRef.current
  }

  const playPcmChunk = async (base64Data: string) => {
    try {
      const ctx = getPlaybackContext()
      if (!ctx) return

      if (ctx.state === "suspended") {
        await ctx.resume()
      }

      const binaryString = window.atob(base64Data)
      const length = binaryString.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const int16Array = new Int16Array(bytes.buffer)
      const float32Array = new Float32Array(int16Array.length)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000)
      audioBuffer.getChannelData(0).set(float32Array)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)

      const now = ctx.currentTime
      if (nextPlaybackTimeRef.current < now) {
        nextPlaybackTimeRef.current = now
      }

      source.start(nextPlaybackTimeRef.current)
      nextPlaybackTimeRef.current += audioBuffer.duration

      activePlaybackNodes.current.add(source)
      source.onended = () => {
        activePlaybackNodes.current.delete(source)
      }
    } catch (error) {
      console.error("PCM playback error:", error)
    }
  }

  const stopAudioPlayback = () => {
    activePlaybackNodes.current.forEach((node) => {
      try {
        node.stop()
      } catch (e) {}
    })
    activePlaybackNodes.current.clear()
    nextPlaybackTimeRef.current = playbackContextRef.current?.currentTime || 0
    setIsAiTalking(false)
    setIsThinking(false)
  }

  // Connect to Gemini Multimodal Live API over raw WebSockets
  const connectGeminiLive = useCallback(async () => {
    if (isInitialized.current) return
    isInitialized.current = true

    setIsConnecting(true)
    setIsThinking(true)

    try {
      const charId = session.interview?.characterId || "sarah"
      const character = getCharacter(charId)
      setInterviewer(character)

      const tokenRes = await fetch(`/api/sessions/${id}/live-token`)
      if (!tokenRes.ok) throw new Error("Failed to fetch live ephemeral token")
      const { token, model, systemInstructions, voiceName } =
        await tokenRes.json()

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`
      const ws = new WebSocket(wsUrl)
      fluxWsRef.current = ws

      ws.onopen = () => {
        setIsConnecting(false)

        // Send setup configuration
        const setupMsg = {
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstructions }],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                silenceDurationMs: 2000,
                prefixPaddingMs: 500,
              },
            },
          },
        }
        ws.send(JSON.stringify(setupMsg))

        // Seed initial history or prompt to greet
        if (messages.length > 0) {
          const turns = messages.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [
              {
                text:
                  typeof m.parts === "string"
                    ? m.parts
                    : (m.parts as MessagePart[])?.find((p) => p.type === "text")
                        ?.text || "",
              },
            ],
          }))
          ws.send(
            JSON.stringify({ clientContent: { turns, turnComplete: true } }),
          )
          setIsThinking(false)
          setIsUsersTurn(messages[messages.length - 1].role === "assistant")
        } else {
          // Trigger first turn greeting
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: "Please start the session by greeting the candidate and introducing yourself.",
                      },
                    ],
                  },
                ],
                turnComplete: true,
              },
            }),
          )
        }
      }

      ws.onmessage = async (event) => {
        if (isPausedRef.current) return

        let jsonData
        if (event.data instanceof Blob) {
          jsonData = await event.data.text()
        } else if (event.data instanceof ArrayBuffer) {
          jsonData = new TextDecoder().decode(event.data)
        } else {
          jsonData = event.data
        }

        try {
          const response = JSON.parse(jsonData)

          // Handle interruption
          if (response.serverContent?.interrupted) {
            console.log("Interruption detected")
            stopAudioPlayback()
            return
          }

          // Play incoming audio chunks
          const parts = response.serverContent?.modelTurn?.parts
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                playPcmChunk(part.inlineData.data)
                setIsAiTalking(true)
                setIsThinking(false)
              }
            }
          }

          // Handle input transcription (user speaking)
          if (response.serverContent?.inputTranscription) {
            const userText = response.serverContent.inputTranscription.text
            if (userText) {
              setLiveTranscript(userText)
              lastUserTextRef.current = userText
            }
          }

          // Handle output transcription (model speaking)
          if (response.serverContent?.outputTranscription) {
            const outputText = response.serverContent.outputTranscription.text
            if (outputText) {
              accumulatedOutputTextRef.current += outputText
            }
          }

          // Handle turn complete
          if (response.serverContent?.turnComplete) {
            const finalUserText = lastUserTextRef.current.trim()
            const finalOutputText = accumulatedOutputTextRef.current.trim()

            // Save user message to database if present
            if (finalUserText) {
              await fetch(`/api/sessions/${id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: "user",
                  text: finalUserText,
                  speakerName: authSession?.user?.name || "Candidate",
                  speakerTitle: "Candidate",
                  duration: timerRef.current,
                }),
              })

              const userMsg: Message = {
                role: "user",
                parts: [
                  {
                    type: "text",
                    text: finalUserText,
                    speakerName: authSession?.user?.name || "Candidate",
                    speakerTitle: "Candidate",
                    isUsersTurn: false,
                    audio: { url: null, path: null },
                  },
                ],
              }
              setMessages((prev) => [...prev, userMsg])
              lastUserTextRef.current = ""
            }

            // Sync saving the interviewer's reply with the audio playback end
            const now = playbackContextRef.current?.currentTime || 0
            const playDelay = (nextPlaybackTimeRef.current - now) * 1000

            setTimeout(
              async () => {
                if (finalOutputText) {
                  await fetch(`/api/sessions/${id}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      role: "assistant",
                      text: finalOutputText,
                      speakerName: character
                        ? `${character.firstName} ${character.lastName}`
                        : "Sarah Miller",
                      speakerTitle: "Interviewer",
                      duration: timerRef.current,
                    }),
                  })

                  const assistantMsg: Message = {
                    role: "assistant",
                    parts: [
                      {
                        type: "text",
                        text: finalOutputText,
                        speakerName: character
                          ? `${character.firstName} ${character.lastName}`
                          : "Sarah Miller",
                        speakerTitle: "Interviewer",
                        isUsersTurn: true,
                        audio: { url: null, path: null },
                      },
                    ],
                  }
                  setMessages((prev) => [...prev, assistantMsg])
                  accumulatedOutputTextRef.current = ""
                }

                setIsAiTalking(false)
                setIsUsersTurn(true)
              },
              Math.max(0, playDelay),
            )
          }
        } catch (err) {
          console.error("Error processing Gemini response:", err)
        }
      }

      ws.onerror = (err) => {
        console.error("Gemini Live WebSocket error:", err)
        setIsConnecting(false)
        setIsThinking(false)
      }

      ws.onclose = () => {
        console.log("Gemini Live WebSocket closed")
        setIsConnecting(false)
        setIsThinking(false)
      }
    } catch (error) {
      console.error("Failed to connect to Gemini Live API:", error)
      setIsConnecting(false)
      setIsThinking(false)
    }
  }, [id, session, authSession, messages.length])

  // Setup mount connection
  useEffect(() => {
    connectGeminiLive()
  }, [connectGeminiLive])

  const stopMicrophoneStreaming = () => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    if (fluxWsRef.current && fluxWsRef.current.readyState === WebSocket.OPEN) {
      // Send audioStreamEnd to signal end of user turn
      fluxWsRef.current.send(
        JSON.stringify({ realtimeInput: { audioStreamEnd: true } }),
      )
    }
  }

  const startMicrophoneStreaming = async () => {
    if (!fluxWsRef.current || fluxWsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("WebSocket connection is not open.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
        },
      })

      micStreamRef.current = stream
      setIsRecording(true)

      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
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

          // Serialize to base64
          let binary = ""
          const bytes = new Uint8Array(pcmData.buffer)
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          const base64Audio = window.btoa(binary)

          // Send chunk to Gemini
          fluxWsRef.current.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  data: base64Audio,
                  mimeType: "audio/pcm;rate=16000",
                },
              },
            }),
          )
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
    } catch (e) {
      console.error("Failed to access microphone:", e)
      toast.error("Could not access microphone.")
    }
  }

  const startRecording = () => {
    setIsConnecting(true)
    transcriptRef.current = ""
    lastPartialRef.current = ""
    setLiveTranscript("")
    setIsConnecting(false)
    startMicrophoneStreaming()
  }

  const stopAndSubmit = () => {
    setIsRecording(false)
    stopMicrophoneStreaming()
    setIsMuted(false)
    setIsPaused(false)
  }

  const toggleRecording = () => {
    if (isRecording) stopAndSubmit()
    else startRecording()
  }

  const stopAndCancel = () => {
    setIsRecording(false)
    stopMicrophoneStreaming()
  }

  const stopAll = useCallback(() => {
    stopMicrophoneStreaming()
    stopAudioPlayback()

    if (fluxWsRef.current) {
      fluxWsRef.current.close()
      fluxWsRef.current = null
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close()
      playbackContextRef.current = null
    }

    setIsRecording(false)
    setIsAiTalking(false)
    setIsThinking(false)
    setIsUserTalking(false)
    setIsAiStreaming(false)
  }, [])

  const handleExit = useCallback(
    (path: string) => {
      stopAll()
      router.push(path)
    },
    [stopAll, router],
  )

  const handleUserResponse = async (text: string, code?: string) => {
    // If user submits code manually, push it down the WebSocket as text input
    if (fluxWsRef.current && fluxWsRef.current.readyState === WebSocket.OPEN) {
      setIsThinking(true)
      const codeSubmissionText = code
        ? `Here is my code submission:\n${code}`
        : text

      fluxWsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: codeSubmissionText,
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        }),
      )

      await fetch(`/api/sessions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          text: codeSubmissionText,
          speakerName: authSession?.user?.name || "Candidate",
          speakerTitle: "Candidate",
          duration: timerRef.current,
        }),
      })

      const userMsg: Message = {
        role: "user",
        parts: [
          {
            type: "text",
            text: codeSubmissionText,
            speakerName: authSession?.user?.name || "Candidate",
            speakerTitle: "Candidate",
            isUsersTurn: false,
            audio: { url: null, path: null },
          },
        ],
      }
      setMessages((prev) => [...prev, userMsg])
    }
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

      if (reader) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6)
              try {
                const parsed = JSON.parse(dataStr)
                if (parsed.type === "text" && parsed.content) {
                  console.log("Interview suggestion chunk:", parsed.content)
                  setStreamedText((prev) => prev + parsed.content)
                }
              } catch (err) {
                // Ignore parsing errors
              }
            }
          }
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
      }
    }
  }, [
    messages.length,
    session.interview?.characterId,
    handleToolCalls,
    messages,
  ])

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
