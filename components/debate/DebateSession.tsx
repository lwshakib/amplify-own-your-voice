"use client"
// @react-compiler-skip

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconX,
  IconPlayerStopFilled,
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconInfoCircle,
  IconScale,
  IconSparkles,
  IconLoader2,
  IconReport,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { CHARACTERS, getCharacter } from "@/lib/characters"
import ReactMarkdown from "react-markdown"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AgentInteraction, AuthUser, Message, MessagePart } from "@/types/features"

interface DebateSessionProps {
  id: string
  session: AgentInteraction & {
    messages: Message[]
    duration: number
    status: string
    userSide: string | null
  }
  authSession: { user: AuthUser } | null
}

type ExtendedMessage = Message & {
  speakerName?: string
  speakerTitle?: string
  audioUrl?: string
  isUsersTurn?: boolean
}

export default function DebateSession({
  id,
  session: initialSession,
  authSession,
}: DebateSessionProps) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState<Message[]>(
    initialSession.messages || [],
  )
  const [isRecording, setIsRecording] = useState(false)
  const transcriptRef = useRef("")
  const [isThinking, setIsThinking] = useState(
    initialSession.messages.length === 0,
  )
  const [isAiTalking, setIsAiTalking] = useState(false)
  const [isUserTalking, setIsUserTalking] = useState(false)
  const [timer, setTimer] = useState(initialSession.duration || 0)
  const timerRef = useRef(timer)
  const [currentSpeaker, setCurrentSpeaker] = useState<{
    name: string
    title: string
  }>({ name: "Sarah", title: "Judge" })
  const [isUsersTurn, setIsUsersTurn] = useState(false)
  const [showSideSelection, setShowSideSelection] = useState(
    !initialSession.userSide,
  )
  const [suggestedText, setSuggestedText] = useState("")
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Prefetch State
  const [prefetchedData, setPrefetchedData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [isPrefetching, setIsPrefetching] = useState(false)

  // Modal State for generic messages
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalContent, setModalContent] = useState("")
  const [hoveredSide, setHoveredSide] = useState<"PRO" | "CON" | null>(null)
  const [selectedSide, setSelectedSide] = useState<"PRO" | "CON" | null>(null)
  const [isConfirmingSide, setIsConfirmingSide] = useState(false)

  const captionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Character Definitions
  const judgeId = session?.debate?.judgeId || "ethan"
  const judgeChar = getCharacter(judgeId)
  const leadId = session?.debate?.opponentId || "sophia"
  const leadChar = getCharacter(leadId) || CHARACTERS[0]
  // Pick two more characters that aren't the lead or judge
  const available = CHARACTERS.filter(
    (c) => c.id !== leadChar.id && c.id !== judgeId,
  )
  const deputyChar = available[0] || CHARACTERS[1]
  const whipChar = available[1] || CHARACTERS[2]

  const isInitialized = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const chatAbortControllerRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isMutedRef = useRef(false)
  const isPausedRef = useRef(false)
  const pendingTurnChangeRef = useRef<boolean | null>(null)
  const isThinkingRef = useRef(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const fluxWsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const lastPartialRef = useRef("")

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

  const handleToolCalls = useCallback((toolCalls: MessagePart[]) => {
    toolCalls.forEach((tc: MessagePart) => {
      const name = tc.name || tc.tool?.name
      const parameters = (tc.parameters || tc.tool?.parameters) as Record<
        string,
        unknown
      >

      if (name === "openModal") {
        setModalTitle((parameters.title as string) || "Notification")
        setModalContent((parameters.content as string) || "")
        setIsModalOpen(true)
      }
    })
  }, [])

  const stopAll = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
    if (captionIntervalRef.current) clearInterval(captionIntervalRef.current)
    stopFluxAsr()
    setIsRecording(false)
    setIsAiTalking(false)
    setIsThinking(false)
    setIsUserTalking(false)
    setLiveTranscript("")
  }, [stopFluxAsr])

  const handleExit = useCallback(
    (path: string) => {
      stopAll()
      router.push(path)
    },
    [stopAll, router],
  )

  const fetchAiResponse = useCallback(
    async (history: Message[], audioUrl?: string, audioPath?: string) => {
      try {
        if (chatAbortControllerRef.current)
          chatAbortControllerRef.current.abort()
        chatAbortControllerRef.current = new AbortController()

        const response = await fetch(`/api/sessions/${id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            duration: timerRef.current,
            audioUrl,
            audioPath,
          }),
          signal: chatAbortControllerRef.current.signal,
        })
        if (!response.ok) throw new Error("Failed to fetch AI response")
        const data = await response.json()

        const textPart = data.parts?.find(
          (p: { type: string }) => p.type === "text",
        )
        const toolCalls =
          data.parts?.filter((p: { type: string }) => p.type === "tool") || []

        return {
          text: textPart?.text || "",
          status: data.status,
          audioUrl: textPart?.audio?.url,
          audioPath: textPart?.audio?.path,
          speakerName: textPart?.speakerName || "Agent",
          speakerTitle: textPart?.speakerTitle || "Moderator",
          isUsersTurn: textPart?.isUsersTurn ?? false,
          toolCalls: toolCalls.length > 0 ? (toolCalls as MessagePart[]) : [],
          userMessageId: data.userMessageId,
          evaluation: data.evaluation,
        }
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return null
        console.error("AI Error:", error)
        return null
      }
    },
    [id],
  )

  const speak = useCallback(
    async (
      text: string,
      isCompleted: boolean = false,
      speakerName?: string,
      speakerTitle?: string,
      audioUrl?: string,
    ) => {
      if (audio) {
        audio.pause()
        audio.src = ""
      }

      try {
        isThinkingRef.current = true
        setIsThinking(true)
        if (!audioUrl) return
        const url = audioUrl
        const newAudio = new Audio(url)

        newAudio.onplay = () => {
          setIsAiTalking(true)
          isThinkingRef.current = false
          setIsThinking(false)
          const words = text.split(/\s+/)
          const wordsPerChunk = 5
          const chunks: string[] = []
          for (let i = 0; i < words.length; i += wordsPerChunk)
            chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
          if (chunks.length > 0) {
            let currentChunkIdx = 0
            const totalDurationMs = newAudio.duration
              ? newAudio.duration * 1000
              : words.length * 350
            const msPerChunk = (totalDurationMs - 200) / chunks.length
            if (captionIntervalRef.current)
              clearInterval(captionIntervalRef.current)
            captionIntervalRef.current = setInterval(
              () => {
                currentChunkIdx++
                if (currentChunkIdx < chunks.length) {
                } else if (captionIntervalRef.current)
                  clearInterval(captionIntervalRef.current)
              },
              Math.max(msPerChunk, 500),
            )
          }
        }
        newAudio.onended = () => {
          setIsAiTalking(false)
          isThinkingRef.current = false
          setIsThinking(false)
          if (captionIntervalRef.current)
            clearInterval(captionIntervalRef.current)
          if (!audioUrl && url) URL.revokeObjectURL(url)
          setCurrentSpeaker({ name: "", title: "" })

          if (pendingTurnChangeRef.current !== null) {
            setIsUsersTurn(pendingTurnChangeRef.current)
            pendingTurnChangeRef.current = null
          }

          if (isCompleted) {
            setSession((prev) =>
              prev ? { ...prev, status: "COMPLETED" } : prev,
            )
            setTimeout(() => handleExit("/sessions"), 3000)
          }
        }
        audioRef.current = newAudio
        setAudio(newAudio)
        newAudio.play().catch((e) => {
          if (e.name === "AbortError") return
          setIsAiTalking(false)
          isThinkingRef.current = false
          setIsThinking(false)
          if (pendingTurnChangeRef.current !== null) {
            setIsUsersTurn(pendingTurnChangeRef.current)
            pendingTurnChangeRef.current = null
          }
        })
      } catch (error) {
        console.error(error)
        setIsAiTalking(false)
        isThinkingRef.current = false
        setIsThinking(false)
      }
    },
    [audio, handleExit],
  )

  const startAiDebate = useCallback(async () => {
    setIsThinking(true)
    const aiResponse = await fetchAiResponse([])
    if (aiResponse) {
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
              url: aiResponse.audioUrl,
              path: aiResponse.audioPath,
            },
          },
          ...(aiResponse.toolCalls
            ? aiResponse.toolCalls.map((tc: MessagePart) => ({
                type: "tool" as const,
                name: (tc.name || tc.tool?.name || "") as string,
                parameters: (tc.parameters ||
                  tc.tool?.parameters ||
                  {}) as Record<string, unknown>,
              }))
            : []),
        ],
      }
      setMessages([assistantMsg])
      setCurrentSpeaker({
        name: aiResponse.speakerName,
        title: aiResponse.speakerTitle,
      })

      if (aiResponse.isUsersTurn) {
        pendingTurnChangeRef.current = true
      } else {
        setIsUsersTurn(false)
        pendingTurnChangeRef.current = null
      }

      if (aiResponse.toolCalls && Array.isArray(aiResponse.toolCalls)) {
        handleToolCalls(aiResponse.toolCalls)
      }

      speak(
        aiResponse.text,
        aiResponse.status === "COMPLETED" || aiResponse.status === "Completed",
        aiResponse.speakerName,
        aiResponse.speakerTitle,
        aiResponse.audioUrl,
      )
    } else {
      setIsThinking(false)
    }
  }, [fetchAiResponse, handleToolCalls, speak])

  // Suggestion Cleanup
  useEffect(() => {
    if (!isUsersTurn) {
      setSuggestedText("")
    }
  }, [isUsersTurn])

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

  useEffect(() => {
    if (isInitialized.current && messages.length > 0) return

    if (session.userSide) {
      if (messages.length > 0) {
        isInitialized.current = true
        const lastMsg: Message = messages[messages.length - 1]
        if (lastMsg.role === "assistant") {
          const textPart = Array.isArray(lastMsg.parts)
            ? (lastMsg.parts as MessagePart[]).find((p) => p.type === "text")
            : null
          const speakerName =
            (textPart as MessagePart)?.speakerName ||
            (lastMsg as ExtendedMessage).speakerName ||
            "AI"
          const speakerTitle =
            (textPart as MessagePart)?.speakerTitle ||
            (lastMsg as ExtendedMessage).speakerTitle ||
            "Moderator"
          const audioUrl =
            textPart?.audio?.url ||
            (lastMsg as Message & { audioUrl?: string }).audioUrl

          setCurrentSpeaker({ name: speakerName, title: speakerTitle })
          setIsUsersTurn(
            !!(
              (textPart as MessagePart)?.isUsersTurn ??
              (lastMsg as ExtendedMessage).isUsersTurn
            ),
          )

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
            speakerName,
            speakerTitle,
            audioUrl,
          )
        }
      } else {
        startAiDebate()
      }
    }
  }, [
    session.userSide,
    messages,
    handleToolCalls,
    speak,
    startAiDebate,
    session,
  ])

  // Prefetch next AI response while current AI is talking
  useEffect(() => {
    // Determine if the last message already signaled a user turn
    const lastMsg = messages[messages.length - 1]
    const isNextStepUser =
      lastMsg?.role === "assistant" &&
      (Array.isArray(lastMsg.parts)
        ? (lastMsg.parts as MessagePart[]).some((p) => p.isUsersTurn)
        : (lastMsg as ExtendedMessage).isUsersTurn)

    if (
      !isUsersTurn &&
      isAiTalking &&
      !isPrefetching &&
      !prefetchedData &&
      !isThinking &&
      session?.status !== "COMPLETED" &&
      !showSideSelection &&
      !isNextStepUser
    ) {
      setIsPrefetching(true)
      fetchAiResponse(messages).then((aiData) => {
        if (aiData && aiData.text) {
          setPrefetchedData(aiData)
        }
        setIsPrefetching(false)
      })
    }
  }, [
    isUsersTurn,
    isAiTalking,
    isPrefetching,
    prefetchedData,
    isThinking,
    messages,
    session?.status,
    showSideSelection,
    fetchAiResponse,
  ])

  // Auto-trigger AI moves
  useEffect(() => {
    if (
      isUsersTurn ||
      isAiTalking ||
      isThinking ||
      isThinkingRef.current ||
      !session ||
      session.status === "COMPLETED" ||
      showSideSelection ||
      isPrefetching
    )
      return
    const triggerNext = async () => {
      isThinkingRef.current = true
      setIsThinking(true)
      setCurrentSpeaker({ name: "", title: "" }) // Clear highlight while thinking

      let aiData = prefetchedData
      if (aiData) {
        setPrefetchedData(null)
      } else {
        aiData = await fetchAiResponse(messages)
      }

      if (aiData && aiData.text) {
        const assistantMsg: Message = {
          role: "assistant",
          parts: [
            {
              type: "text" as const,
              text: aiData.text as string,
              speakerName: aiData.speakerName as string,
              speakerTitle: aiData.speakerTitle as string,
              isUsersTurn: !!aiData.isUsersTurn,
              audio: {
                url: aiData.audioUrl as string | null,
                path: aiData.audioPath as string | null,
              },
            },
            ...(aiData.toolCalls
              ? (aiData.toolCalls as MessagePart[]).map((tc) => ({
                  type: "tool" as const,
                  name: (tc.name || tc.tool?.name || "") as string,
                  parameters: (tc.parameters ||
                    tc.tool?.parameters ||
                    {}) as Record<string, unknown>,
                }))
              : []),
          ],
        }
        setMessages((prev) => [...prev, assistantMsg])
        setCurrentSpeaker({
          name: aiData.speakerName as string,
          title: aiData.speakerTitle as string,
        })

        // Delay setting isUsersTurn until the speech ends
        if (aiData.isUsersTurn) {
          pendingTurnChangeRef.current = true
        } else {
          setIsUsersTurn(false)
          pendingTurnChangeRef.current = null
        }

        if (aiData.toolCalls && Array.isArray(aiData.toolCalls)) {
          handleToolCalls(aiData.toolCalls as MessagePart[])
        }

        speak(
          aiData.text as string,
          aiData.status === "COMPLETED" || aiData.status === "Completed",
          aiData.speakerName as string,
          aiData.speakerTitle as string,
          aiData.audioUrl as string,
        )
      } else {
        isThinkingRef.current = false
        setIsThinking(false)
      }
    }
    triggerNext() // Execute instantly when AI is done streaming the final segment
  }, [
    id,
    isUsersTurn,
    isAiTalking,
    isThinking,
    session,
    messages,
    fetchAiResponse,
    handleToolCalls,
    speak,
    prefetchedData,
    isPrefetching,
    showSideSelection,
  ])

  const handleConfirmSide = async () => {
    if (!selectedSide) return
    setIsConfirmingSide(true)
    try {
      setSession((prev) => (prev ? { ...prev, userSide: selectedSide } : prev))
      await fetch(`/api/debates/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userSide: selectedSide }),
      })
      setShowSideSelection(false)
      startAiDebate()
    } catch (error) {
      console.error("Error confirming side:", error)
    } finally {
      setIsConfirmingSide(false)
    }
  }

  const handleSelectSide = (side: "PRO" | "CON") => {
    setSelectedSide(side)
  }

  const handleGetSuggestion = async () => {
    if (suggestedText) {
      setSuggestedText("")
      return
    }
    if (isSuggesting) return
    setIsSuggesting(true)
    setSuggestedText("")
    try {
      const res = await fetch(`/api/debates/sessions/${id}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })
      if (!res.ok) throw new Error("Failed to fetch suggestion")

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream found")

      const decoder = new TextDecoder()
      let result = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value, { stream: true })
        setSuggestedText(result)
      }
    } catch (error) {
      console.error("Suggestion error:", error)
    } finally {
      setIsSuggesting(false)
    }
  }

  const startFluxAsr = async () => {
    const token = await fetchAsrToken()
    if (!token) return

    const workerUrl = `${process.env.NEXT_PUBLIC_FLUX_WORKER_URL || "wss://flux.leadwithshakib.workers.dev/"}?token=${token}`

    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
        },
      })

      fluxWsRef.current = new WebSocket(workerUrl)

      fluxWsRef.current.onopen = () => {
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
            fluxWsRef.current.send(pcmData.buffer)
          }
        }

        source.connect(processor)
        processor.connect(audioContext.destination)

        // Standard MediaRecorder for higher quality audio upload
        const mediaRecorder = new MediaRecorder(micStreamRef.current!)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        mediaRecorder.start()
      }

      if (fluxWsRef.current) {
        fluxWsRef.current.onmessage = (e: MessageEvent) => {
          if (isPausedRef.current) return
          try {
            const data = JSON.parse(e.data)
            if (data.transcript) {
              const clean = data.transcript.trim()
              if (clean) {
                if (
                  lastPartialRef.current &&
                  data.transcript.length <
                    lastPartialRef.current.length * 0.7 &&
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
      }

      if (fluxWsRef.current) {
        fluxWsRef.current.onerror = (err) => console.error("ASR WS Error:", err)
        fluxWsRef.current.onclose = () => stopFluxAsr()
      }
    } catch (e) {
      console.error("Mic Access Error:", e)
    }
  }

  const startRecording = () => {
    transcriptRef.current = ""
    lastPartialRef.current = ""
    setLiveTranscript("")
    const turnIndex = messages.length

    // Determine the user's role based on the debate sequence
    const turnToTitleMap: Record<number, string> = {
      1: "Prime Minister",
      3: "Leader of Opposition",
      5: "Deputy Prime Minister",
      7: "Deputy Leader of Opposition",
      9: "Affirmative Rebuttal",
      11: "Opposition Whip",
    }
    const myRole = turnToTitleMap[turnIndex] || ""
    setCurrentSpeaker({ name: authSession?.user?.name || "You", title: myRole })

    setIsRecording(true)
    startFluxAsr()
    // Browser SpeechRecognition removed since unused as per lint
    // startFluxAsr() handles it.
  }

  const stopAndSubmit = async () => {
    const finalTranscript = (
      transcriptRef.current +
      " " +
      (lastPartialRef.current || "")
    )
      .replace(/\s+/g, " ")
      .trim()
    setIsRecording(false)
    // recognition?.stop() removed since unused

    const audioUploadingPromise = (async () => {
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

          // Get a signed URL for immediate playback
          const res = await fetch(
            `/api/s3/signed-url?path=${encodeURIComponent(path)}`,
          )
          const { url } = await res.json()

          return { url, path }
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

    if (finalTranscript) {
      handleUserResponse(finalTranscript, audioUploadingPromise)
    }
    setCurrentSpeaker({ name: "", title: "" }) // Clear highlight after recording stops
    transcriptRef.current = ""
    lastPartialRef.current = ""
    setLiveTranscript("")
  }

  const toggleRecording = () => {
    if (isRecording) stopAndSubmit()
    else startRecording()
  }

  const handleUserResponse = async (
    text: string,
    audioPromise?: Promise<{
      url: string | null
      path: string | null
    } | null>,
  ) => {
    const user = authSession?.user
    const isUserPro = session?.userSide === "PRO"
    const userMsg: Message = {
      role: "user",
      parts: [
        {
          type: "text",
          text,
          speakerName: user?.name || "You",
          speakerTitle: isUserPro ? "Prime Minister" : "Leader of Opposition",
          isUsersTurn: false,
        },
      ],
    }
    const newMessages: Message[] = [...messages, userMsg]
    setSuggestedText("")
    setMessages(newMessages)
    setIsThinking(true)
    setCurrentSpeaker({ name: "", title: "" }) // Clear highlight when user responds

    // Fetch AI response immediately
    const aiResponsePromise = fetchAiResponse(newMessages)

    // Handle audio upload and patch in background
    if (audioPromise) {
      Promise.all([aiResponsePromise, audioPromise]).then(
        async ([aiData, uploadResult]) => {
          const result = uploadResult as {
            url: string | null
            path: string | null
          } | null
          if (aiData?.userMessageId && result?.url) {
            try {
              await fetch(`/api/messages/${aiData.userMessageId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audioUrl: result.url,
                  audioPath: result.path,
                }),
              })
            } catch (err) {
              console.error("Failed to patch message audio:", err)
            }
          }
        },
      )
    }

    const aiData = await aiResponsePromise
    if (aiData && aiData.text) {
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
      setCurrentSpeaker({
        name: aiData.speakerName,
        title: aiData.speakerTitle,
      })

      // Delay setting isUsersTurn until the speech ends
      if (aiData.isUsersTurn) {
        pendingTurnChangeRef.current = true
      } else {
        setIsUsersTurn(false)
        pendingTurnChangeRef.current = null
      }

      if (aiData.toolCalls && Array.isArray(aiData.toolCalls)) {
        handleToolCalls(aiData.toolCalls)
      }

      speak(
        aiData.text,
        aiData.status === "COMPLETED" || aiData.status === "Completed",
        aiData.speakerName,
        aiData.speakerTitle,
        aiData.audioUrl,
      )
    } else {
      setIsThinking(false)
    }
  }

  useEffect(() => {
    return () => stopAll()
  }, [stopAll])

  const user = authSession?.user
  const sideSelected =
    session?.userSide === "PRO" || session?.userSide === "CON"
  const isUserPro = session?.userSide === "PRO"
  const isUserCon = session?.userSide === "CON"

  const affirmativeTeam = [
    {
      name: isUserPro
        ? user?.name || "You"
        : sideSelected && leadChar
          ? `${leadChar.firstName} ${leadChar.lastName}`
          : "Pending...",
      title: "Prime Minister",
      active: currentSpeaker.title === "Prime Minister",
      avatar: isUserPro
        ? undefined
        : sideSelected
          ? leadChar?.avatar
          : undefined,
    },
    {
      name: isUserPro
        ? user?.name || "You"
        : sideSelected && deputyChar
          ? `${deputyChar.firstName} ${deputyChar.lastName}`
          : "Pending...",
      title: "Deputy PM",
      active:
        currentSpeaker.title === "Deputy PM" ||
        currentSpeaker.title === "Deputy Prime Minister",
      avatar: isUserPro
        ? undefined
        : sideSelected
          ? deputyChar?.avatar
          : undefined,
    },
    {
      name: isUserPro
        ? user?.name || "You"
        : sideSelected && whipChar
          ? `${whipChar.firstName} ${whipChar.lastName}`
          : "Pending...",
      title: "Affirmative Rebuttal",
      active:
        currentSpeaker.title === "Affirmative Rebuttal" ||
        currentSpeaker.title === "Rebuttal Speaker",
      avatar: isUserPro
        ? undefined
        : sideSelected
          ? whipChar?.avatar
          : undefined,
    },
  ]
  const negativeTeam = [
    {
      name: isUserCon
        ? user?.name || "You"
        : sideSelected && leadChar
          ? `${leadChar.firstName} ${leadChar.lastName}`
          : "Pending...",
      title: "Leader of Opposition",
      active: currentSpeaker.title === "Leader of Opposition",
      avatar: isUserCon
        ? undefined
        : sideSelected
          ? leadChar?.avatar
          : undefined,
    },
    {
      name: isUserCon
        ? user?.name || "You"
        : sideSelected && deputyChar
          ? `${deputyChar.firstName} ${deputyChar.lastName}`
          : "Pending...",
      title: "Deputy LO",
      active:
        currentSpeaker.title === "Deputy LO" ||
        currentSpeaker.title === "Deputy Leader of Opposition",
      avatar: isUserCon
        ? undefined
        : sideSelected
          ? deputyChar?.avatar
          : undefined,
    },
    {
      name: isUserCon
        ? user?.name || "You"
        : sideSelected && whipChar
          ? `${whipChar.firstName} ${whipChar.lastName}`
          : "Pending...",
      title: "Opposition Whip",
      active: currentSpeaker.title === "Opposition Whip",
      avatar: isUserCon
        ? undefined
        : sideSelected
          ? whipChar?.avatar
          : undefined,
    },
  ]

  return (
    <div className="h-screen w-screen bg-[#050505] flex flex-col overflow-hidden text-zinc-100 font-sans">
      {/* Top Bar */}
      <div className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => handleExit(`/debates`)}
            className="text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full p-2 transition-colors shrink-0"
          >
            <IconX size={20} />
          </button>
          <div className="hidden sm:block h-4 w-px bg-zinc-800 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IconScale size={16} className="text-primary shrink-0" />
              <h1 className="text-sm font-bold truncate max-w-[120px] sm:max-w-[200px] md:max-w-[400px]">
                {session?.debate?.subject}
              </h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <Button
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-full gap-2 px-3 md:px-6 h-9 font-mono"
            onClick={() => handleExit(`/debates`)}
          >
            <IconPlayerStopFilled size={14} />
            <span className="text-xs md:text-sm font-bold tracking-tight">
              {Math.floor(timer / 60)}:
              {(timer % 60).toString().padStart(2, "0")}
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-12 relative overflow-y-auto custom-scrollbar">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square bg-primary/5 rounded-full blur-[160px] pointer-events-none" />

        {/* Judge Section */}
        <div className="flex flex-col items-center mb-8 md:mb-12 z-20 shrink-0">
          <motion.div
            animate={
              currentSpeaker.title === "Judge"
                ? { scale: 1.1, y: 10 }
                : { scale: 1, y: 0 }
            }
            className={cn(
              "size-24 md:size-32 rounded-full border-4 transition-all duration-500 relative flex items-center justify-center bg-zinc-950 overflow-hidden shadow-2xl",
              currentSpeaker.title === "Judge"
                ? "border-primary shadow-[0_0_50px_rgba(var(--primary),0.3)]"
                : "border-zinc-800",
            )}
          >
            <Avatar className="size-full">
              <AvatarImage src={judgeChar?.avatar} className="object-cover" />
              <AvatarFallback>J</AvatarFallback>
            </Avatar>
            {currentSpeaker.title === "Judge" &&
              (isAiTalking || isThinking) && (
                <div className="absolute inset-0 bg-primary/10 animate-pulse" />
              )}
          </motion.div>
          <div className="text-center mt-4">
            <h3 className="text-base md:text-lg font-bold tracking-tight">
              {judgeChar?.firstName} {judgeChar?.lastName}
            </h3>
            <p className="text-zinc-500 text-[10px] md:text-xs font-medium">
              Presiding judge • Moderator
            </p>
          </div>
        </div>

        {/* Teams Section */}
        <div className="flex-1 flex flex-col md:flex-row items-center md:items-start justify-between gap-12 md:gap-8 lg:px-12 relative z-10 w-full max-w-7xl mx-auto">
          {/* Affirmative Team */}
          <div className="flex flex-col gap-4 md:gap-6 w-full md:w-[320px] lg:w-[380px]">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1">
              Affirmative team
            </h2>
            <div className="flex flex-col gap-3">
              {isUserPro && (isSuggesting || suggestedText) ? (
                <div className="relative p-5 rounded-2xl border border-emerald-500/50 bg-zinc-900 overflow-hidden flex flex-col h-[270px]">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                      <IconSparkles size={14} /> AI coach suggestion
                    </span>
                    <button
                      onClick={() => {
                        setSuggestedText("")
                        setIsSuggesting(false)
                      }}
                      className="text-zinc-500 hover:text-white transition-colors bg-zinc-950/50 rounded-full p-1"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 text-sm text-zinc-300 leading-relaxed pr-3 whitespace-pre-wrap">
                    {suggestedText}
                    {isSuggesting && (
                      <span className="inline-block size-2 bg-emerald-500 rounded-full animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              ) : (
                affirmativeTeam.map((m, i) => (
                  <motion.div
                    key={i}
                    animate={
                      m.active ? { scale: 1.02, x: 10 } : { scale: 1, x: 0 }
                    }
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 relative",
                      m.active
                        ? "bg-zinc-900 border-emerald-500/50"
                        : "bg-zinc-950 border-zinc-900 opacity-40",
                    )}
                  >
                    <Avatar
                      className={cn(
                        "size-10 rounded-xl border border-transparent",
                        m.active && "border-emerald-500",
                      )}
                    >
                      <AvatarImage src={m.avatar || user?.image || undefined} />
                      <AvatarFallback className="bg-zinc-900 text-emerald-500 font-bold">
                        {m.title[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-100 text-sm">
                        {m.name}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-500">
                        {m.title}
                      </span>
                    </div>
                    {m.active && (isAiTalking || isUserTalking) && (
                      <div className="ml-auto flex gap-1 items-end h-3">
                        {[1, 2, 3].map((j) => (
                          <motion.div
                            key={j}
                            animate={{ height: [4, 10, 4] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.5,
                              delay: j * 0.1,
                            }}
                            className="w-0.5 bg-emerald-500 rounded-full"
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Interaction Controls for Affirmative User */}
            {isUserPro &&
              isUsersTurn &&
              !isAiTalking &&
              !isThinking &&
              session?.status !== "COMPLETED" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 mt-4"
                >
                  <div className="flex gap-2 w-full">
                    {isRecording && (
                      <>
                        <Button
                          onClick={() => setIsPaused(!isPaused)}
                          variant="outline"
                          className="size-11 rounded-xl border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 font-bold shadow-xl"
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
                              : "bg-zinc-900/50 border-zinc-800",
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
                      onClick={toggleRecording}
                      className={cn(
                        "flex-1 h-11 rounded-xl font-bold text-xs gap-2 transition-all",
                        isRecording
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-emerald-600 hover:bg-emerald-700",
                      )}
                    >
                      {isRecording ? (
                        <IconMicrophoneOff size={16} />
                      ) : (
                        <IconMicrophone size={16} />
                      )}
                      {isRecording ? "Stop & submit" : "Speak now"}
                    </Button>
                  </div>
                  <Button
                    onClick={handleGetSuggestion}
                    disabled={isSuggesting}
                    variant="outline"
                    className="h-10 rounded-xl border-zinc-800 bg-zinc-900/50 gap-2 hover:bg-zinc-800 text-xs font-bold text-zinc-500"
                  >
                    {isSuggesting ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : (
                      <IconSparkles size={14} />
                    )}
                    AI coach
                  </Button>
                </motion.div>
              )}
          </div>

          {/* Negative Team */}
          <div className="flex flex-col gap-4 md:gap-6 w-full md:w-[320px] lg:w-[380px] items-start md:items-end">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1 text-left md:text-right w-full">
              Negative team
            </h2>
            <div className="flex flex-col gap-4 w-full">
              {isUserCon && (isSuggesting || suggestedText) ? (
                <div className="relative p-5 rounded-2xl border border-rose-500/50 bg-zinc-900 overflow-hidden flex flex-col h-[270px]">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                      <IconSparkles size={14} /> AI coach suggestion
                    </span>
                    <button
                      onClick={() => {
                        setSuggestedText("")
                        setIsSuggesting(false)
                      }}
                      className="text-zinc-500 hover:text-white transition-colors bg-zinc-950/50 rounded-full p-1"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 text-sm text-zinc-300 leading-relaxed pr-3 whitespace-pre-wrap text-left">
                    {suggestedText}
                    {isSuggesting && (
                      <span className="inline-block size-2 bg-rose-500 rounded-full animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              ) : (
                negativeTeam.map((m, i) => (
                  <motion.div
                    key={i}
                    animate={
                      m.active ? { scale: 1.02, x: -10 } : { scale: 1, x: 0 }
                    }
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 flex items-center flex-row-reverse gap-4 relative",
                      m.active
                        ? "bg-zinc-900 border-rose-500/50"
                        : "bg-zinc-950 border-zinc-900 opacity-40",
                    )}
                  >
                    <Avatar
                      className={cn(
                        "size-10 rounded-xl border border-transparent",
                        m.active && "border-rose-500",
                      )}
                    >
                      <AvatarImage src={m.avatar || user?.image || undefined} />
                      <AvatarFallback className="bg-zinc-900 text-rose-500 font-bold">
                        {m.title[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-zinc-100 text-sm">
                        {m.name}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-500">
                        {m.title}
                      </span>
                    </div>
                    {m.active && (isAiTalking || isUserTalking) && (
                      <div className="mr-auto flex gap-1 items-end h-3">
                        {[1, 2, 3].map((j) => (
                          <motion.div
                            key={j}
                            animate={{ height: [4, 10, 4] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.5,
                              delay: j * 0.1,
                            }}
                            className="w-0.5 bg-rose-500 rounded-full"
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Interaction Controls for Negative User */}
            {isUserCon &&
              isUsersTurn &&
              !isAiTalking &&
              !isThinking &&
              session?.status !== "COMPLETED" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 mt-4 w-full"
                >
                  <div className="flex gap-2 w-full">
                    {isRecording && (
                      <>
                        <Button
                          onClick={() => setIsPaused(!isPaused)}
                          variant="outline"
                          className="size-11 rounded-xl border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 font-bold shadow-xl"
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
                              : "bg-zinc-900/50 border-zinc-800",
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
                      onClick={toggleRecording}
                      className={cn(
                        "flex-1 h-11 rounded-xl font-bold text-xs gap-2 transition-all",
                        isRecording
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-emerald-600 hover:bg-emerald-700",
                      )}
                    >
                      {isRecording ? (
                        <IconMicrophoneOff size={16} />
                      ) : (
                        <IconMicrophone size={16} />
                      )}
                      {isRecording ? "Stop & submit" : "Speak now"}
                    </Button>
                  </div>
                  <Button
                    onClick={handleGetSuggestion}
                    disabled={isSuggesting}
                    variant="outline"
                    className="h-10 rounded-xl border-zinc-800 bg-zinc-900/50 gap-2 hover:bg-zinc-800 text-xs font-bold text-zinc-500"
                  >
                    {isSuggesting ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : (
                      <IconSparkles size={14} />
                    )}
                    AI coach
                  </Button>
                </motion.div>
              )}
          </div>
        </div>

        <div className="mt-auto h-24 flex flex-col items-center justify-center p-8 bg-zinc-950/40 backdrop-blur-3xl border-t border-white/5 rounded-3xl z-50">
          <AnimatePresence mode="wait">
            {(!isUsersTurn || isAiTalking || isThinking) &&
            session?.status !== "COMPLETED" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex gap-1.5">
                  {isAiTalking || isThinking ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [4, 12, 4] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          delay: i * 0.1,
                        }}
                        className="w-0.5 bg-zinc-700 rounded-full"
                      />
                    ))
                  ) : (
                    <div className="size-1 rounded-full bg-zinc-800" />
                  )}
                </div>
                <span className="text-xs font-medium text-zinc-500 italic">
                  {isThinking
                    ? `${currentSpeaker.name} is formulating arguments...`
                    : isAiTalking
                      ? `${currentSpeaker.name} is speaking...`
                      : `Observing floor...`}
                </span>
              </motion.div>
            ) : session?.status === "COMPLETED" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-6"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <IconReport size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm font-bold text-white tracking-tight leading-none">
                      Debate concluded
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium mt-1">
                      Duration: {Math.floor(timer / 60)}m {timer % 60}s
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleExit(`/sessions/${id}`)}
                  variant="outline"
                  className="h-10 px-6 rounded-xl border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-all font-bold text-xs text-emerald-400"
                >
                  View Report
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Live Transcription Display */}
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
                <p className="text-sm text-zinc-100 font-medium tracking-tight leading-relaxed italic drop-shadow-lg origin-bottom">
                  {liveTranscript}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSideSelection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-4xl bg-background border border-border shadow-2xl relative overflow-hidden flex flex-col rounded-3xl max-h-[95vh] m-2"
            >
              <div className="flex flex-col md:flex-row h-full overflow-y-auto">
                {/* Left Side: Selection */}
                <div className="flex-1 p-6 md:p-12 space-y-8 border-b md:border-b-0 md:border-r border-border/50">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        Debate motion
                      </h3>
                      <p className="text-base text-foreground">
                        {session?.debate?.subject}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Select your side
                      </h2>
                      <p className="text-muted-foreground text-sm font-medium">
                        Choose the position you want to represent
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onMouseEnter={() => setHoveredSide("PRO")}
                      onMouseLeave={() => setHoveredSide(null)}
                      onClick={() => handleSelectSide("PRO")}
                      className={cn(
                        "relative group flex items-center justify-between p-6 rounded-2xl border transition-all text-left",
                        selectedSide === "PRO"
                          ? "bg-emerald-500/5 border-emerald-500 ring-1 ring-emerald-500"
                          : "bg-muted/50 border-border hover:border-zinc-700 hover:bg-muted",
                      )}
                    >
                      <div className="flex flex-col">
                        <h4 className="text-lg font-bold text-foreground">
                          Affirmative
                        </h4>
                        <p className="text-xs text-zinc-500 font-medium mt-1">
                          Government side
                        </p>
                      </div>
                      <div
                        className={cn(
                          "size-6 rounded-full border transition-all flex items-center justify-center",
                          selectedSide === "PRO"
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-zinc-800",
                        )}
                      >
                        {selectedSide === "PRO" && (
                          <div className="size-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>

                    <button
                      onMouseEnter={() => setHoveredSide("CON")}
                      onMouseLeave={() => setHoveredSide(null)}
                      onClick={() => handleSelectSide("CON")}
                      className={cn(
                        "relative group flex items-center justify-between p-6 rounded-2xl border transition-all text-left",
                        selectedSide === "CON"
                          ? "bg-rose-500/5 border-rose-500 ring-1 ring-rose-500"
                          : "bg-muted/50 border-border hover:border-zinc-700 hover:bg-muted",
                      )}
                    >
                      <div className="flex flex-col">
                        <h4 className="text-lg font-bold text-foreground">
                          Negative
                        </h4>
                        <p className="text-xs text-zinc-500 font-medium mt-1">
                          Opposition side
                        </p>
                      </div>
                      <div
                        className={cn(
                          "size-6 rounded-full border transition-all flex items-center justify-center",
                          selectedSide === "CON"
                            ? "bg-rose-500 border-rose-500"
                            : "border-zinc-800",
                        )}
                      >
                        {selectedSide === "CON" && (
                          <div className="size-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right Side: Preview */}
                <div className="flex-1 bg-muted/20 p-6 md:p-12 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-bold text-muted-foreground">
                      Practice panel preview
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-5 border-muted-foreground/20 font-bold text-muted-foreground px-2"
                    >
                      {(selectedSide || hoveredSide || "PRO") === "PRO"
                        ? "Affirmative"
                        : "Negative"}{" "}
                      members
                    </Badge>
                  </div>

                  <div className="space-y-8 flex-1">
                    {/* Judge Section */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-zinc-400">
                        Presiding judge
                      </h4>
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 shadow-sm">
                        <Avatar className="size-10 rounded-lg border border-border">
                          <AvatarImage
                            src={judgeChar?.avatar}
                            className="object-cover"
                          />
                          <AvatarFallback>J</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-foreground truncate">
                            {judgeChar?.firstName} {judgeChar?.lastName}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
                            Moderate & Rule
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Opposition Members */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-zinc-400">
                        Opposing members
                      </h4>
                      <div className="flex flex-col gap-3">
                        {(selectedSide || hoveredSide || "PRO") &&
                          [leadChar, deputyChar, whipChar].map((char, i) => {
                            const side = selectedSide || hoveredSide || "PRO"
                            const roles =
                              side === "PRO"
                                ? [
                                    "Opposition Leader",
                                    "Opposition Deputy",
                                    "Opposition Whip",
                                  ]
                                : [
                                    "Prime Minister",
                                    "Deputy Prime Minister",
                                    "Government Whip",
                                  ]

                            return (
                              <div
                                key={i}
                                className="flex items-center gap-4 p-3 rounded-xl hover:bg-background/40 transition-colors"
                              >
                                <Avatar className="size-9 rounded-lg border border-border/50">
                                  <AvatarImage
                                    src={char?.avatar}
                                    className="object-cover"
                                  />
                                  <AvatarFallback>{roles[i][0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-foreground truncate">
                                    {char?.firstName} {char?.lastName}
                                  </span>
                                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
                                    {roles[i]}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-10">
                    <Button
                      disabled={!selectedSide || isConfirmingSide}
                      onClick={handleConfirmSide}
                      className={cn(
                        "w-full h-14 rounded-2xl font-bold text-sm gap-2 transition-all shadow-xl",
                        selectedSide === "PRO"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : selectedSide === "CON"
                            ? "bg-rose-600 hover:bg-rose-500 text-white"
                            : "bg-primary text-primary-foreground",
                      )}
                    >
                      {isConfirmingSide ? (
                        <IconLoader2 className="animate-spin" size={18} />
                      ) : null}
                      {isConfirmingSide
                        ? "Entering session..."
                        : "Start debate session"}
                    </Button>
                  </div>
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
      `}</style>
      {/* Generic Modal Tool */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-[#0a0a0a] border-zinc-800 rounded-[2.5rem] p-12 overflow-hidden shadow-2xl shadow-primary/10">
          <DialogHeader className="space-y-4 mb-6 text-left">
            <div className="flex items-center gap-3 text-zinc-500 mb-2">
              <IconInfoCircle size={20} />
              <span className="text-xs font-bold">Agent notification</span>
            </div>
            <DialogTitle className="text-3xl font-bold tracking-tight text-white">
              {modalTitle || "Information"}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-invert prose-sm max-w-none opacity-80 leading-relaxed text-lg text-left">
            <ReactMarkdown>{modalContent}</ReactMarkdown>
          </div>
          <div className="mt-12 flex justify-end">
            <Button
              onClick={() => setIsModalOpen(false)}
              variant="outline"
              className="rounded-xl border-zinc-800 hover:bg-zinc-900 px-8 h-10 text-xs font-bold text-white"
            >
              Acknowledge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
