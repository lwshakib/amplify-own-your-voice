import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { aiService } from "@/services/ai.services"
import { ChatBatchSchema } from "@/schemas/chat"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const json = await req.json()
    const validation = ChatBatchSchema.safeParse(json)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { messages } = validation.data

    // Fetch the custom agent session
    const interaction = await prisma.agentInteraction.findUnique({
      where: { id: sessionId },
      include: {
        aiPersona: true,
        user: true,
      },
    })

    if (!interaction || !interaction.aiPersona) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const agentName = interaction.aiPersona.name
    const agentInstruction = interaction.aiPersona.instruction

    const coreMessages = messages.map(
      (m: { role: string; content?: string }) => ({
        role: m.role,
        content: m.content || "",
      }),
    )

    if (
      coreMessages.length > 0 &&
      coreMessages[coreMessages.length - 1].role === "assistant"
    ) {
      coreMessages.push({
        role: "user",
        content:
          "Help me formulate a creative and engaging response to continue this conversation.",
      })
    }

    const systemPrompt = `
You are an expert Communication Coach. 
The user is talking to an AI Persona named: "${agentName}"
The AI Persona's instructions/personality: ${agentInstruction}

TASK:
Provide a concise, engaging, and high-impact response (max 1000 characters) for the user to say. 
The response should be consistent with the conversation's flow and help the user express themselves effectively.

FORMAT:
Return ONLY the text of the speech. 
Do not include any introductory notes or coaching advice.
Just the raw response content.
`

    const text = await aiService.generateText([
      { role: "system", content: systemPrompt },
      ...coreMessages,
    ])

    return NextResponse.json({ suggestion: text.trim() })
  } catch (error) {
    console.error("Error in suggestion API:", error)
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 },
    )
  }
}
