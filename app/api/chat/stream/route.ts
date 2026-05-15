import { aiService } from "@/services/ai.services"
import { validateSession } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { CoachStreamSchema } from "@/schemas/coach"

import { getFeatureLogic } from "@/features/registry"

export async function POST(req: Request) {
  try {
    const { errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const body = await req.json()
    const validation = CoachStreamSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const {
      messages,
      candidateName,
      interviewerName,
      interviewType,
      jobTitle,
      jobDescription,
      currentTranscript,
      sessionType,
      personaInstructions,
    } = validation.data

    const feature = getFeatureLogic(sessionType || "INTERVIEW")

    if (!feature) {
      return NextResponse.json(
        { error: "Session type not supported" },
        { status: 400 },
      )
    }

    const systemInstruction = feature.getCoachPrompt({
      candidateName,
      interviewerName,
      interviewType,
      jobTitle,
      jobDescription,
      currentTranscript,
      personaInstructions,
    })

    // Normalize messages to extract text from parts for the LLM
    const normalizedMessages = (
      messages as {
        role: string
        parts?:
          | string
          | {
              type: string
              text?: string
              name?: string
              parameters?: Record<string, unknown>
            }[]
        content?: string
      }[]
    ).map((m) => {
      let content = ""
      if (typeof m.parts === "string") {
        content = m.parts
      } else if (Array.isArray(m.parts)) {
        content = m.parts
          .filter((p: { type: string; text?: string }) => p.type === "text")
          .map((p: { text?: string }) => p.text)
          .join("\n")

        // Include code content if present
        const codeTool = m.parts.find(
          (p: { type: string; name?: string }) =>
            p.type === "tool" && p.name === "open_editor",
        ) as { parameters?: { code?: string } } | undefined
        if (codeTool?.parameters?.code) {
          content += `\n\n[CODE SUBMISSION]:\n${codeTool.parameters.code}`
        }
      } else if (m.content) {
        content = m.content
      }
      return { role: m.role, content }
    })

    const augmentedMessages = [
      ...normalizedMessages,
      {
        role: "system",
        content: systemInstruction,
      },
    ]

    const stream = await aiService.streamText(augmentedMessages)

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (error: unknown) {
    console.error("Streaming API Error:", error)
    const message =
      error instanceof Error ? error.message : "Failed to generate stream"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
