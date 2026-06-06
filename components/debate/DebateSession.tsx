"use client"
// @react-compiler-skip

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import {
  AgentInteraction,
  AuthUser,
  Message,
  MessagePart,
} from "@/types/features"

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
  const messagesRef = useRef(messages)
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
  const isMutedRef = useRef(false)
  const isPausedRef = useRef(false)

  const fluxWsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  // Web Audio playback context & scheduling
  const playbackContextRef = useRef<AudioContext | null>(null)
  const nextPlaybackTimeRef = useRef<number>(0)
  const activePlaybackNodes = useRef<Set<AudioBufferSourceNode>>(new Set())
  const accumulatedOutputTextRef = useRef<string>("")
  const lastUserTextRef = useRef<string>("")

  const getPlaybackContext = () => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
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
      fluxWsRef.current.send(
        JSON.stringify({ realtimeInput: { audioStreamEnd: true } }),
      )
    }
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
    setLiveTranscript("")
  }, [])

  const handleExit = useCallback(
    (path: string) => {
      stopAll()
      router.push(path)
    },
    [stopAll, router],
  )

  const getDebateTurnInfo = (turnIndex: number, userSide: string) => {
    const judge = judgeChar
    const lead = leadChar
    const deputy = deputyChar
    const whip = whipChar
    const userName = authSession?.user?.name || "You"
    const isUserPro = userSide === "PRO"

    const rolesSequence = [
      {
        id: 1,
        speaker: judge,
        role: "Judge",
        title: "Judge Opening",
        isUser: false,
        prompt:
          "Please start the debate by presenting and welcoming the audience, then invite the Prime Minister.",
      },
      {
        id: 2,
        speaker: isUserPro ? { firstName: userName } : lead,
        role: "Prime Minister",
        title: "Prime Minister Speech",
        isUser: isUserPro,
        prompt:
          "Please deliver the Prime Minister opening speech supporting the motion.",
      },
      {
        id: 3,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Lead Opponent",
        isUser: false,
        prompt:
          "Preside as the judge: synthesize the Prime Minister's speech, then invite the Leader of Opposition to speak next.",
      },
      {
        id: 4,
        speaker: isUserPro ? lead : { firstName: userName },
        role: "Leader of Opposition",
        title: "Leader of Opposition Speech",
        isUser: !isUserPro,
        prompt:
          "Please deliver the Leader of Opposition opening speech opposing the motion.",
      },
      {
        id: 5,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Deputy PM",
        isUser: false,
        prompt:
          "Preside as the judge: synthesize the Leader of Opposition's speech, then invite the Deputy Prime Minister to speak next.",
      },
      {
        id: 6,
        speaker: isUserPro ? { firstName: userName } : deputy,
        role: "Deputy Prime Minister",
        title: "Deputy Prime Minister Speech",
        isUser: isUserPro,
        prompt:
          "Please deliver the Deputy Prime Minister speech supporting the motion.",
      },
      {
        id: 7,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Deputy LO",
        isUser: false,
        prompt:
          "Preside as the judge: synthesize the Deputy Prime Minister's speech, then invite the Deputy Leader of Opposition to speak next.",
      },
      {
        id: 8,
        speaker: isUserPro ? deputy : { firstName: userName },
        role: "Deputy Leader of Opposition",
        title: "Deputy Leader of Opposition Speech",
        isUser: !isUserPro,
        prompt:
          "Please deliver the Deputy Leader of Opposition speech opposing the motion.",
      },
      {
        id: 9,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Affirmative Rebuttal",
        isUser: false,
        prompt:
          "Preside as the judge: synthesize the Deputy Leader of Opposition's speech, then invite the Affirmative Rebuttal speaker next.",
      },
      {
        id: 10,
        speaker: isUserPro ? { firstName: userName } : whip,
        role: "Affirmative Rebuttal",
        title: "Affirmative Rebuttal Speech",
        isUser: isUserPro,
        prompt:
          "Please deliver the Affirmative Rebuttal speech supporting the motion.",
      },
      {
        id: 11,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Opposition Whip",
        isUser: false,
        prompt:
          "Preside as the judge: synthesize the Affirmative Rebuttal speech, then invite the Opposition Whip next.",
      },
      {
        id: 12,
        speaker: isUserPro ? whip : { firstName: userName },
        role: "Opposition Whip",
        title: "Opposition Whip Speech",
        isUser: !isUserPro,
        prompt:
          "Please deliver the Opposition Whip speech opposing the motion.",
      },
      {
        id: 13,
        speaker: judge,
        role: "Judge",
        title: "Judge Closing & Winner",
        isUser: false,
        prompt:
          "Preside as the judge: summarize the debate, announce the winner, and close the session.",
      },
    ]

    const step =
      rolesSequence[turnIndex] || rolesSequence[rolesSequence.length - 1]
    const isLast = turnIndex >= 12
    return { ...step, isLast }
  }

  const getSpeakerName = (speaker?: any, fallback = "You") => {
    if (!speaker) return fallback
    return `${speaker.firstName || ""} ${speaker.lastName || ""}`.trim()
  }

  // Connect to Gemini Live over WebSocket
  const connectGeminiLive = useCallback(async () => {
    if (isInitialized.current) return
    isInitialized.current = true

    setIsThinking(true)

    try {
      const tokenRes = await fetch(`/api/sessions/${id}/live-token`)
      if (!tokenRes.ok) throw new Error("Failed to fetch live ephemeral token")
      const { token, model, systemInstructions, voiceName } =
        await tokenRes.json()

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`
      const ws = new WebSocket(wsUrl)
      fluxWsRef.current = ws

      ws.onopen = () => {
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

          const nextStep = getDebateTurnInfo(
            messages.length,
            session.userSide || "PRO",
          )
          setIsUsersTurn(nextStep.isUser)
          setCurrentSpeaker({
            name: getSpeakerName(nextStep.speaker, "You"),
            title: nextStep.role,
          })
        } else {
          // Trigger first turn: Judge Opening
          const currentStep = getDebateTurnInfo(0, session.userSide || "PRO")
          setCurrentSpeaker({
            name: getSpeakerName(currentStep.speaker, "Judge"),
            title: currentStep.role,
          })
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: currentStep.prompt,
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

            const now = playbackContextRef.current?.currentTime || 0
            const playDelay = (nextPlaybackTimeRef.current - now) * 1000

            // Sync with end of AI speech
            setTimeout(
              async () => {
                const currentTurnIndex = messagesRef.current.length
                const currentStep = getDebateTurnInfo(
                  currentTurnIndex,
                  session.userSide || "PRO",
                )

                if (!currentStep.isUser) {
                  // AI Turn finished
                  if (finalOutputText) {
                    await fetch(`/api/sessions/${id}/messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        role: "assistant",
                        text: finalOutputText,
                        speakerName: getSpeakerName(
                          currentStep.speaker,
                          "Judge",
                        ),
                        speakerTitle: currentStep.role,
                        status: currentStep.isLast
                          ? "COMPLETED"
                          : "IN_PROGRESS",
                        duration: timerRef.current,
                      }),
                    })

                    const assistantMsg: Message = {
                      role: "assistant",
                      parts: [
                        {
                          type: "text",
                          text: finalOutputText,
                          speakerName: getSpeakerName(
                            currentStep.speaker,
                            "Judge",
                          ),
                          speakerTitle: currentStep.role,
                          isUsersTurn: false,
                          audio: { url: null, path: null },
                        },
                      ],
                    }
                    setMessages((prev) => [...prev, assistantMsg])
                    accumulatedOutputTextRef.current = ""
                  }

                  if (currentStep.isLast) {
                    setSession((prev) =>
                      prev ? { ...prev, status: "COMPLETED" } : prev,
                    )
                    setTimeout(() => handleExit("/debates"), 3000)
                    return
                  }

                  const nextTurnIndex = currentTurnIndex + 1
                  const nextStep = getDebateTurnInfo(
                    nextTurnIndex,
                    session.userSide || "PRO",
                  )

                  setIsUsersTurn(nextStep.isUser)
                  setCurrentSpeaker({
                    name: getSpeakerName(nextStep.speaker, "You"),
                    title: nextStep.role,
                  })

                  if (!nextStep.isUser) {
                    ws.send(
                      JSON.stringify({
                        clientContent: {
                          turns: [
                            {
                              role: "user",
                              parts: [
                                {
                                  text: nextStep.prompt,
                                },
                              ],
                            },
                          ],
                          turnComplete: true,
                        },
                      }),
                    )
                    setIsThinking(true)
                  }
                } else {
                  // User Turn finished & transition model reply finished
                  const modelTurnIndex = currentTurnIndex + 1
                  const modelStep = getDebateTurnInfo(
                    modelTurnIndex,
                    session.userSide || "PRO",
                  )

                  if (finalUserText) {
                    await fetch(`/api/sessions/${id}/messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        role: "user",
                        text: finalUserText,
                        speakerName: authSession?.user?.name || "You",
                        speakerTitle: currentStep.role,
                        duration: timerRef.current,
                      }),
                    })
                  }

                  if (finalOutputText) {
                    await fetch(`/api/sessions/${id}/messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        role: "assistant",
                        text: finalOutputText,
                        speakerName: getSpeakerName(modelStep.speaker, "Judge"),
                        speakerTitle: modelStep.role,
                        status: modelStep.isLast ? "COMPLETED" : "IN_PROGRESS",
                        duration: timerRef.current,
                      }),
                    })
                  }

                  const userMsg: Message = {
                    role: "user",
                    parts: [
                      {
                        type: "text",
                        text: finalUserText,
                        speakerName: authSession?.user?.name || "You",
                        speakerTitle: currentStep.role,
                        isUsersTurn: false,
                        audio: { url: null, path: null },
                      },
                    ],
                  }

                  const assistantMsg: Message = {
                    role: "assistant",
                    parts: [
                      {
                        type: "text",
                        text: finalOutputText,
                        speakerName: getSpeakerName(modelStep.speaker, "Judge"),
                        speakerTitle: modelStep.role,
                        isUsersTurn: false,
                        audio: { url: null, path: null },
                      },
                    ],
                  }

                  setMessages((prev) => [...prev, userMsg, assistantMsg])
                  lastUserTextRef.current = ""
                  accumulatedOutputTextRef.current = ""

                  if (modelStep.isLast) {
                    setSession((prev) =>
                      prev ? { ...prev, status: "COMPLETED" } : prev,
                    )
                    setTimeout(() => handleExit("/debates"), 3000)
                    return
                  }

                  const nextTurnIndex = currentTurnIndex + 2
                  const nextStep = getDebateTurnInfo(
                    nextTurnIndex,
                    session.userSide || "PRO",
                  )

                  setIsUsersTurn(nextStep.isUser)
                  setCurrentSpeaker({
                    name: getSpeakerName(nextStep.speaker, "You"),
                    title: nextStep.role,
                  })

                  if (!nextStep.isUser) {
                    ws.send(
                      JSON.stringify({
                        clientContent: {
                          turns: [
                            {
                              role: "user",
                              parts: [
                                {
                                  text: nextStep.prompt,
                                },
                              ],
                            },
                          ],
                          turnComplete: true,
                        },
                      }),
                    )
                    setIsThinking(true)
                  }
                }
                setIsAiTalking(false)
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
        setIsThinking(false)
      }

      ws.onclose = () => {
        console.log("Gemini Live WebSocket closed")
        setIsThinking(false)
      }
    } catch (error) {
      console.error("Failed to connect to Gemini Live API:", error)
      setIsThinking(false)
    }
  }, [id, session, authSession])

  const startAiDebate = useCallback(() => {
    connectGeminiLive()
  }, [connectGeminiLive])

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
                console.log("Debate suggestion chunk:", parsed.content)
                setSuggestedText((prev) => prev + parsed.content)
              }
            } catch (err) {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Suggestion error:", error)
    } finally {
      setIsSuggesting(false)
    }
  }

  // stopMicrophoneStreaming is declared above stopAll

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
        window.AudioContext || (window as any).webkitAudioContext
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

          let binary = ""
          const bytes = new Uint8Array(pcmData.buffer)
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          const base64Audio = window.btoa(binary)

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
    transcriptRef.current = ""
    lastUserTextRef.current = ""
    setLiveTranscript("")
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

  // Sync refs with state
  useEffect(() => {
    isMutedRef.current = isMuted
    isPausedRef.current = isPaused
  }, [isMuted, isPaused])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
