import { NextRequest, NextResponse } from "next/server"
import { aiService } from "@/services/ai.services"
import { JobDescriptionGenerationSchema } from "@/schemas/generation"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = JobDescriptionGenerationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { jobTitle, type } = validation.data

    const isTechnical = type?.toUpperCase() === "TECHNICAL"
    const { getJobDescriptionSystemPrompt, getJobDescriptionUserPrompt } =
      await import("@/features/interview/prompts")

    const messages = [
      { role: "system", content: getJobDescriptionSystemPrompt() },
      {
        role: "user",
        content: getJobDescriptionUserPrompt(jobTitle, isTechnical),
      },
    ]

    const stream = await aiService.streamText(messages, req.signal)

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 204 })
    }
    console.error("Generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate job description" },
      { status: 500 },
    )
  }
}
