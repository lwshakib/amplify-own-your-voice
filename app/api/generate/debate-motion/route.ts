import { NextResponse } from "next/server"
import { generateText } from "@/llm/generateText"
import { DebateMotionSchema } from "@/schemas/generation"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validation = DebateMotionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { prompt } = validation.data

    const { getDebateMotionPrompt } = await import("@/lib/debate/prompts")
    const messages = [
      {
        role: "system",
        content: getDebateMotionPrompt(),
      },
      {
        role: "user",
        content: `Topic: ${prompt}`,
      },
    ]

    const motion = await generateText(messages)

    return NextResponse.json({ motion: motion.trim() })
  } catch (error: unknown) {
    console.error("Debate motion generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate motion" },
      { status: 500 },
    )
  }
}
